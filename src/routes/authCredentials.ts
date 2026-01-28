// src/routes/authCredentials.ts
import { Express, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../db/db";
import { masonPcSide, authSessions } from "../db/schema";
import { eq, and } from "drizzle-orm";

// Reusing your constants from authFirebase.ts
const JWT_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60;

export default function setupAuthCredentialRoutes(app: Express) {
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
          userId: parseInt(tsoId), // Assign the TSO (This links to 'users' table)
          deviceId: deviceId || null,
          kycStatus: "pending_tso", // Special status for TSO App to see
          firebaseUid: tempUid,
          pointsBalance: 0,
        });
      } else {
        // Update existing mason to re-assign TSO
        await db.update(masonPcSide)
          .set({ 
            userId: parseInt(tsoId),
            deviceId: deviceId, // Lock device
            kycStatus: "pending_tso"
          })
          .where(eq(masonPcSide.id, mason.id));
      }

      // TODO: Send Notification to TSO (tsoId) here using your notifications table

      return res.status(200).json({ success: true, message: "Interest registered. Waiting for TSO." });
    } catch (e: any) {
      console.error("Register Interest Error:", e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // 2. CREDENTIAL LOGIN (User App -> Backend)
  // Authenticates using the TSO-generated User ID & Password
  app.post("/api/auth/credential-login", async (req: Request, res: Response) => {
    try {
      const { userId, password, deviceId } = req.body;

      if (!userId || !password) {
        return res.status(400).json({ success: false, error: "Credentials required" });
      }

      // 1. Find Mason. 
      // STRATEGY: We stored credentials in `firebaseUid` as "USERID|PASSWORD"
      // We search for the record that exactly matches this composite string.
      
      const compositeCredential = `${userId}|${password}`;
      
      const [mason] = await db.select()
        .from(masonPcSide)
        .where(eq(masonPcSide.firebaseUid, compositeCredential)) // Exact match check
        .limit(1);

      if (!mason) {
        return res.status(401).json({ success: false, error: "Invalid User ID or Password" });
      }

      // 2. Device Lock Check
      if (mason.deviceId && deviceId && mason.deviceId !== deviceId) {
         return res.status(403).json({ success: false, error: "DEVICE_LOCKED", message: "Account locked to another device." });
      }
      
      // If no device locked yet, lock it now
      if (!mason.deviceId && deviceId) {
        await db.update(masonPcSide).set({ deviceId }).where(eq(masonPcSide.id, mason.id));
        mason.deviceId = deviceId;
      }

      // 3. Generate Session & JWT (Same as your Firebase Flow)
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
}