import { Express, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../db/db";
import { masonPcSide, authSessions } from "../db/schema";
import { eq, and } from "drizzle-orm";

// Reusing your constants from authFirebase.ts
const JWT_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60;

// Helper to generate simple password
function generateSimplePassword(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function setupAuthCredentialRoutes(app: Express) {

  // 1. REGISTER INTEREST (User App -> Backend)
  app.post("/api/auth/register-interest", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, tsoId, deviceId } = req.body;

      if (!phoneNumber || !tsoId) {
        return res.status(400).json({ success: false, error: "Phone and TSO ID required" });
      }

      // Check if mason already exists
      let mason = (await db.select().from(masonPcSide).where(eq(masonPcSide.phoneNumber, phoneNumber)).limit(1))[0];

      if (!mason) {
        const tempUid = `PENDING:${phoneNumber}:${Date.now()}`;
        
        await db.insert(masonPcSide).values({
          id: crypto.randomUUID(),
          name: "New Mason",
          phoneNumber: phoneNumber,
          userId: parseInt(tsoId),
          deviceId: deviceId || null,
          kycStatus: "pending_tso",
          firebaseUid: tempUid,
          pointsBalance: 0,
        });
      } else {
        await db.update(masonPcSide)
          .set({ 
            userId: parseInt(tsoId),
            deviceId: deviceId, 
            kycStatus: "pending_tso"
          })
          .where(eq(masonPcSide.id, mason.id));
      }

      return res.status(200).json({ success: true, message: "Interest registered. Waiting for TSO." });
    } catch (e: any) {
      console.error("Register Interest Error:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // 2. CREDENTIAL LOGIN (User App -> Backend)
  app.post("/api/auth/credential-login", async (req: Request, res: Response) => {
    try {
      const { userId, password, deviceId } = req.body;

      if (!userId || !password) {
        return res.status(400).json({ success: false, error: "Credentials required" });
      }

      const compositeCredential = `${userId}|${password}`;
      
      const [mason] = await db.select()
        .from(masonPcSide)
        .where(eq(masonPcSide.firebaseUid, compositeCredential))
        .limit(1);

      if (!mason) {
        return res.status(401).json({ success: false, error: "Invalid User ID or Password" });
      }

      if (mason.deviceId && deviceId && mason.deviceId !== deviceId) {
         return res.status(403).json({ success: false, error: "DEVICE_LOCKED", message: "Account locked to another device." });
      }
      
      if (!mason.deviceId && deviceId) {
        await db.update(masonPcSide).set({ deviceId }).where(eq(masonPcSide.id, mason.id));
        mason.deviceId = deviceId;
      }

      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

      await db.insert(authSessions).values({
        sessionId: crypto.randomUUID(),
        masonId: mason.id,
        sessionToken,
        createdAt: new Date(),
        expiresAt: sessionExpiresAt,
      });

      const jwtToken = jwt.sign(
        { sub: mason.id, role: "mason", phone: mason.phoneNumber, kyc: mason.kycStatus },
        process.env.JWT_SECRET!,
        { expiresIn: JWT_TTL_SECONDS }
      );

      return res.status(200).json({
        success: true,
        jwt: jwtToken,
        sessionToken: sessionToken,
        mason: {
          id: mason.id,
          name: mason.name,
          phoneNumber: mason.phoneNumber,
          kycStatus: mason.kycStatus,
          pointsBalance: mason.pointsBalance,
          deviceId: mason.deviceId
        }
      });

    } catch (e: any) {
      console.error("Credential Login Error:", e);
      return res.status(500).json({ success: false, error: "Login failed" });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. MIGRATE LEGACY USER (OTP -> Credentials + Auto Login)
  // ---------------------------------------------------------------------------
  app.post("/api/auth/migrate-legacy", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, deviceId } = req.body; // ✅ Added deviceId input

      if (!phoneNumber) {
        return res.status(400).json({ success: false, error: "Phone number required" });
      }

      // 1. Find Mason by Phone
      const [mason] = await db.select().from(masonPcSide).where(eq(masonPcSide.phoneNumber, phoneNumber)).limit(1);

      if (!mason) {
        return res.status(404).json({ success: false, error: "User not found. Please register first." });
      }

      // 2. Check/Generate Credentials
      let userId, password;
      const currentUid = mason.firebaseUid || "";

      if (currentUid.includes("|")) {
        // ALREADY MIGRATED: Parse existing credentials
        [userId, password] = currentUid.split("|");
      } else {
        // NOT MIGRATED: Generate New Credentials
        const cleanName = (mason.name || "USER").replace(/[^a-zA-Z]/g, '').toUpperCase();
        const prefix = cleanName.length >= 4 ? cleanName.substring(0, 4) : cleanName.padEnd(4, 'X');
        const phoneStr = mason.phoneNumber || "0000";
        const suffix = phoneStr.length >= 4 ? phoneStr.substring(phoneStr.length - 4) : "0000";
        
        userId = `${prefix}${suffix}`;
        password = generateSimplePassword(6);
        const compositeCredentials = `${userId}|${password}`;

        // Save credentials to DB
        await db.update(masonPcSide)
          .set({ firebaseUid: compositeCredentials })
          .where(eq(masonPcSide.id, mason.id));
      }

      // 3. ✅ AUTO LOGIN LOGIC STARTS HERE
      
      // Update Device Lock if needed (Similar to login)
      if (deviceId) {
        await db.update(masonPcSide).set({ deviceId }).where(eq(masonPcSide.id, mason.id));
      }

      // Generate Session
      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

      await db.insert(authSessions).values({
        sessionId: crypto.randomUUID(),
        masonId: mason.id,
        sessionToken,
        createdAt: new Date(),
        expiresAt: sessionExpiresAt,
      });

      // Generate JWT
      const jwtToken = jwt.sign(
        { sub: mason.id, role: "mason", phone: mason.phoneNumber, kyc: mason.kycStatus },
        process.env.JWT_SECRET!,
        { expiresIn: JWT_TTL_SECONDS }
      );

      // 4. Return Combined Response (Credentials + Token)
      return res.status(200).json({
        success: true,
        message: "Migration successful.",
        // Credentials for the User to see/save
        credentials: { 
          userId, 
          password, 
          qrData: JSON.stringify({ u: userId, p: password }) 
        },
        // Token for the App to auto-login
        jwt: jwtToken,
        sessionToken: sessionToken,
        mason: { 
          id: mason.id, 
          name: mason.name, 
          phoneNumber: mason.phoneNumber,
          kycStatus: mason.kycStatus,
          pointsBalance: mason.pointsBalance,
          deviceId: deviceId || mason.deviceId
        }
      });

    } catch (e: any) {
      console.error("Migration Error:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });
}