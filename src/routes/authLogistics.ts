// src/routes/authLogistics.ts
import { Express, Request, Response, NextFunction } from "express";
import { db } from '../db/db';
import { logisticsUsers } from "../db/schema";
import { eq } from "drizzle-orm";
import pkg from 'jsonwebtoken';

const { sign, verify } = pkg;

// --------------------------------------------------
// JWT Verification Middleware for Logistics
// --------------------------------------------------
export const verifyLogisticsToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is missing' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  verify(token, process.env.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or expired' });
    }
    (req as any).user = user;
    next();
  });
};

// --------------------------------------------------
// ROUTES
// --------------------------------------------------
export default function setupAuthLogisticsRoutes(app: Express) {
  
  app.post("/api/logistics-auth/login", async (req: Request, res: Response): Promise<any> => {
    try {
      const { userName, userPassword } = req.body;

      if (!userName || !userPassword) {
         return res.status(400).json({ error: "Username and password are required" });
      }

      if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // Find user
      const [user] = await db.select().from(logisticsUsers).where(eq(logisticsUsers.userName, userName));
      
      if (!user) {
        return res.status(401).json({ error: "Invalid username" });
      }

      // Plain text password comparison
      if (user.userPassword !== userPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      // Generate JWT
      const token = sign(
        { 
          id: user.id, 
          userName: user.userName, 
          userRole: user.userRole,
          sourceName: user.sourceName
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Return user data alongside the token
      res.status(200).json({
        success: true,
        token, // Pass the generated token to the frontend
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