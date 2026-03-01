// src/routes/authLogistics.ts
import { Express, Request, Response } from "express";
import { db } from '../db/db';
import { logisticsUsers } from "../db/schema";
import { eq } from "drizzle-orm";

export default function setupAuthLogisticsRoutes(app: Express) {
  
  // Changed route to /api/logistics-auth/login
  app.post("/api/logistics-auth/login", async (req: Request, res: Response): Promise<any> => {
    try {
      const { userName, userPassword } = req.body;

      if (!userName || !userPassword) {
         return res.status(400).json({ error: "Username and password are required" });
      }

      // Changed variable name to 'user' to prevent shadowing the schema import
      const [user] = await db.select().from(logisticsUsers).where(eq(logisticsUsers.userName, userName));
      
      if (!user) {
        return res.status(401).json({ error: "Invalid username" });
      }

      // Fixed plain text password comparison
      if (user.userPassword !== userPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      // Return user data
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          sourceName: user.sourceName,
          userName: user.userName,
          userRole: user.userRole
        }
      });

    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}