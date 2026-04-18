// src/middleware/verifyDashboardJWT.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET;
if (!DASHBOARD_JWT_SECRET) {
  throw new Error("DASHBOARD_JWT_SECRET is not defined");
}

export const verifyDashboardJWT = (req : Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token, DASHBOARD_JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};