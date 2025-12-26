// src/routes/authFirebase.ts
import { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";
import { db } from "../db/db";
import { masonPcSide } from "../db/schema";
import { authSessions } from "../db/schema";
import { eq, and, lt } from "drizzle-orm";

// 7-day expiry for the main JWT
const JWT_TTL_SECONDS = 60 * 60 * 24 * 7;
// 60-day expiry for the persistent refresh token
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60;

// Utility to verify the JWT
const verifyJwt = (token: string) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as { sub: string, role: string, iat: number, exp: number };
  } catch (e) {
    return null; // Token is invalid or expired
  }
};

export default function setupAuthFirebaseRoutes(app: Express) {

  /**
   * POST /api/auth/firebase
   * This is the main Sign-Up / Login endpoint.
   * It exchanges a Firebase ID Token for our app's JWT and Session Token.
   */
  app.post("/api/auth/firebase", async (req: Request, res: Response) => {
    try {
      // 1. Get name (for sign-up) and idToken from the request body
      const { idToken, name, deviceId, fcmToken } = req.body;
      if (!idToken) {
        return res.status(400).json({ success: false, error: "idToken required" });
      }

      // 2. Verify the Firebase token to get the user's phone and UID
      const decoded = await getAuth().verifyIdToken(idToken);
      const firebaseUid = decoded.uid;
      const phone = decoded.phone_number || null;
      if (!phone) {
        return res.status(400).json({ success: false, error: "Phone missing in Firebase token" });
      }

      // 3. --- UPSERT MASON LOGIC ---
      // Try to find the mason by their unique Firebase UID first
      let mason = (await db.select().from(masonPcSide).where(eq(masonPcSide.firebaseUid, firebaseUid)).limit(1))[0];

      if (!mason) {
        // Not found by UID, try to find by Phone Number
        mason = (await db.select().from(masonPcSide).where(eq(masonPcSide.phoneNumber, phone)).limit(1))[0];

        if (!mason) {
          // --- Case A: NEW USER (Sign Up) ---
          // Mason not found by phone OR UID. Create them.
          const created = await db.insert(masonPcSide).values({
            id: crypto.randomUUID(),
            name: name || "New Contractor",
            phoneNumber: phone,
            firebaseUid,
            // ✅ LOCK TO DEVICE IMMEDIATELY ON SIGN UP
            deviceId: deviceId || null,
            fcmToken: fcmToken || null,
            kycStatus: "none",
            pointsBalance: 0,
          }).returning();
          mason = created[0];
        } else {
          // Case B: EXISTING USER, LINKING FIREBASE FOR FIRST TIME
          // Check if they already have a device locked to their phone record
          if (mason.deviceId && deviceId && mason.deviceId !== deviceId) {
            return res.status(403).json({
              success: false,
              error: "DEVICE_LOCKED",
              message: "This account is locked to another device. Please contact Admin."
            });
          }

          // Found by phone, but not UID. Link the Firebase UID to the existing account.
          const finalUpdates: Partial<typeof masonPcSide.$inferInsert> = {
            firebaseUid,
            // ✅ Ensure we lock the device if it wasn't locked before
            deviceId: mason.deviceId || deviceId,
            fcmToken: fcmToken || mason.fcmToken
          };

          if (name && mason.name === "New Contractor") {
            finalUpdates.name = name;
          }

          await db.update(masonPcSide)
            .set(finalUpdates)
            .where(eq(masonPcSide.id, mason.id));

          mason = { ...mason, ...finalUpdates };
        }
      }
      else {
        // --- Case C: RETURNING USER (Found by Firebase UID) ---

        // 1. 🔒 SECURITY CHECK: Enforce Device Lock
        // If DB has a lock, and incoming ID doesn't match -> BLOCK.
        if (mason.deviceId && deviceId && mason.deviceId !== deviceId) {
          return res.status(403).json({
            success: false,
            error: "DEVICE_LOCKED",
            message: "This account is registered to a different device."
          });
        }

        // 2. 🔄 UPDATE LOGIC
        const updates: Partial<typeof masonPcSide.$inferInsert> = {};

        // If account has NO lock (null), lock it to this device now
        if (!mason.deviceId && deviceId) {
          updates.deviceId = deviceId;
          mason.deviceId = deviceId; // Update local object for response
        }

        // Always update FCM token if fresh one provided
        if (fcmToken && fcmToken !== mason.fcmToken) {
          updates.fcmToken = fcmToken;
        }

        // Run update if there are changes
        if (Object.keys(updates).length > 0) {
          await db.update(masonPcSide)
            .set(updates)
            .where(eq(masonPcSide.id, mason.id));
        }
      }

      // 4. Create a persistent session (for "Remember Me")
// Optional: only delete expired sessions
await db.delete(authSessions)
  .where(
    and(
      eq(authSessions.masonId, mason.id),
      lt(authSessions.expiresAt, new Date())
    )
  );


      const sessionToken = crypto.randomBytes(32).toString("hex");
      const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000); // 60 days
      await db.insert(authSessions).values({
        sessionId: crypto.randomUUID(),
        masonId: mason.id,
        sessionToken,
        createdAt: new Date(),
        expiresAt: sessionExpiresAt,
      });

      // 5. Create the short-lived JWT (for API access)
      const jwtToken = jwt.sign(
        { sub: mason.id, role: "mason", phone: mason.phoneNumber, kyc: mason.kycStatus },
        process.env.JWT_SECRET!,
        { expiresIn: JWT_TTL_SECONDS } // 7 days
      );

      // 6. Return everything to the app
      return res.status(200).json({
        success: true,
        jwt: jwtToken,
        sessionToken: sessionToken,
        sessionExpiresAt: sessionExpiresAt,
        mason: {
          id: mason.id,
          phoneNumber: mason.phoneNumber,
          name: mason.name,
          kycStatus: mason.kycStatus,
          pointsBalance: mason.pointsBalance,
          firebaseUid: mason.firebaseUid,
          deviceId: mason.deviceId, // Return the active device ID
        },
      });
    } catch (e) {
      console.error("auth/firebase error:", e);
      return res.status(401).json({ success: false, error: "Invalid Firebase token and/or Device Id" });
    }
  });

  /**
   * GET /api/auth/validate
   * Checks if a JWT is valid and returns the user's data.
   * This is used for "Auto-Login" on app start.
   */
  app.get("/api/auth/validate", async (req: Request, res: Response) => {
    const authHeader = req.header("Authorization");
    const sessionToken = req.header("x-session-token");

    if (!authHeader || !authHeader.startsWith("Bearer ") || !sessionToken) {
      return res.status(401).json({ success: false, error: "Authorization missing" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyJwt(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }

    const [session] = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.sessionToken, sessionToken))
      .limit(1);

    if (!session || session.expiresAt === null || session.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ success: false, error: "Session invalid" });
    }

    const [mason] = await db
      .select()
      .from(masonPcSide)
      .where(eq(masonPcSide.id, decoded.sub))
      .limit(1);

    if (!mason) {
      return res.status(404).json({ success: false, error: "User missing" });
    }

    return res.status(200).json({ success: true, mason });
  });

  /**
   * POST /api/auth/refresh
   * Exchanges a valid (but long-lived) Session Token for a new JWT and Session Token.
   * This is the second step of "Auto-Login" if the JWT was expired.
   */
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const token = req.header("x-session-token");
      if (!token) return res.status(400).json({ success: false, error: "x-session-token required" });

      // Find the session in the DB
      const [session] = await db.select().from(authSessions).where(eq(authSessions.sessionToken, token)).limit(1);

      // Check if session exists and is not expired
      if (!session || !session.expiresAt || session.expiresAt < new Date()) {
        // If expired, delete it
        if (session) {
          await db.delete(authSessions).where(eq(authSessions.sessionId, session.sessionId));
        }
        return res.status(401).json({ success: false, error: "Session expired or invalid" });
      }

      // Find the associated mason
      const [mason] = await db.select().from(masonPcSide).where(eq(masonPcSide.id, session.masonId)).limit(1);
      if (!mason) return res.status(401).json({ success: false, error: "Unknown user" });

      // ✅ DEVICE SECURITY CHECK
      const deviceId = req.header("x-device-id");
      if (mason.deviceId && deviceId && mason.deviceId !== deviceId) {
        return res.status(403).json({ 
          success: false, 
          code: "DEVICE_LOCKED",
          message: "Session invalid for this device."
        });
      }

      // --- SESSION IS VALID ---
      // 1. Create a new JWT
      const jwtToken = jwt.sign(
        { sub: mason.id, role: "mason", phone: mason.phoneNumber, kyc: mason.kycStatus },
        process.env.JWT_SECRET!,
        { expiresIn: JWT_TTL_SECONDS } // 7 days
      );

      // 2. Create a new Session Token and update the DB
      const newSessionToken = crypto.randomBytes(32).toString("hex");
      const newSessionExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000); // 60 days

      await db.update(authSessions)
        .set({ sessionToken: newSessionToken, expiresAt: newSessionExpiresAt, createdAt: new Date() })
        .where(eq(authSessions.sessionId, session.sessionId));

      // 3. Return the new tokens and mason data
      return res.status(200).json({
        success: true,
        jwt: jwtToken,
        sessionToken: newSessionToken,
        sessionExpiresAt: newSessionExpiresAt,
        mason: {
          id: mason.id,
          phoneNumber: mason.phoneNumber,
          name: mason.name,
          kycStatus: mason.kycStatus,
          pointsBalance: mason.pointsBalance,
          firebaseUid: mason.firebaseUid
        },
      });
    } catch (e) {
      console.error("auth/refresh error:", e);
      return res.status(500).json({ success: false, error: "Refresh failed" });
    }
  });

  /**
   * POST /api/auth/logout
   * Deletes the persistent session token from the database.
   */
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const token = req.header("x-session-token");
      if (!token) return res.status(400).json({ success: false, error: "x-session-token required" });

      // Delete the session. We don't care if it fails, we just want it gone.
      await db.delete(authSessions).where(eq(authSessions.sessionToken, token));

      return res.status(200).json({ success: true, message: "Logged out" });
    } catch (e) {
      return res.status(500).json({ success: false, error: "Logout failed" });
    }
  });

  /**
   * POST /api/auth/dev-bypass
   * (DEV ONLY) A route to bypass Firebase OTP for testing.
   */
  app.post("/api/auth/dev-bypass", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== "development") {
      return res.status(403).json({ success: false, error: "Forbidden in production" });
    }

    try {
      const { phone, name, deviceId, fcmToken } = req.body;
      if (!phone) return res.status(400).json({ success: false, error: "Phone required" });

      let mason = (await db.select().from(masonPcSide).where(eq(masonPcSide.phoneNumber, phone)).limit(1))[0];

      if (!mason) {
        // Create new mason for dev
        const created = await db.insert(masonPcSide).values({
          id: crypto.randomUUID(),
          name: name || "Dev Contractor",
          phoneNumber: phone,
          firebaseUid: `dev_${phone}`, // Create a fake UID
          deviceId: deviceId || null,
          fcmToken: fcmToken || null,
          kycStatus: "none",
          pointsBalance: 0,
        }).returning();
        mason = created[0];
      } else {
        // Update existing Dev User
        const updates: any = {};
        if (deviceId) updates.deviceId = deviceId;
        if (fcmToken) updates.fcmToken = fcmToken;
        
        if (Object.keys(updates).length > 0) {
           await db.update(masonPcSide).set(updates).where(eq(masonPcSide.id, mason.id));
           // Update local obj
           if(deviceId) mason.deviceId = deviceId;
        }
      }

      // Create Session
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
        sessionExpiresAt: sessionExpiresAt,
        mason: {
          id: mason.id,
          phoneNumber: mason.phoneNumber,
          name: mason.name,
          kycStatus: mason.kycStatus,
          pointsBalance: mason.pointsBalance,
          firebaseUid: mason.firebaseUid,
          deviceId: mason.deviceId
        },
      });

    } catch (e) {
      console.error("auth/dev-bypass error:", e);
      return res.status(500).json({ success: false, error: "Dev bypass failed" });
    }
  });

  /**
   * PATCH /api/auth/fcm-token
   * Updates the FCM token for the currently authenticated Mason.
   */
  app.patch("/api/auth/fcm-token", async (req: Request, res: Response) => {
    const authHeader = req.header("Authorization");
    const fcmToken = req.body.fcmToken;

    if (!authHeader || !fcmToken) {
      return res.status(400).json({ success: false, error: "Auth header and fcmToken required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyJwt(token);

    if (!decoded) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    try {
      await db.update(masonPcSide)
        .set({ fcmToken: fcmToken })
        .where(eq(masonPcSide.id, decoded.sub));

      return res.status(200).json({ success: true, message: "FCM Token updated" });
    } catch (e) {
      console.error("FCM Token update error:", e);
      return res.status(500).json({ success: false, error: "Database error" });
    }
  });
}