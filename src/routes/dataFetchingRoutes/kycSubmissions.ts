// server/src/routes/dataFetchingRoutes/kycSubmissions.ts

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { kycSubmissions, masonPcSide } from '../../db/schema';
import { eq, and, desc, SQL, getTableColumns } from 'drizzle-orm'; 

// Helper function to handle BigInt safety
function toJsonSafe(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ));
}

export default function setupKycSubmissionsRoutes(app: Express) {
  const tableName = 'KYC Submission';
  const endpoint = 'kyc-submissions';

  // Helper for converting query params to numbers
  const numberish = (v: unknown) => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
  };

  // --- GET ALL - with TSO FILTER & JOINS ---
  // /api/kyc-submissions?userId=...&status=pending&limit=50
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { limit = '50', status, masonId, userId } = req.query;

      const conditions: SQL[] = [];

      // 1. Filter by status
      if (status) {
        conditions.push(eq(kycSubmissions.status, status as string));
      }

      // 2. Filter by masonId (UUID)
      if (masonId) {
        conditions.push(eq(kycSubmissions.masonId, masonId as string));
      }

      // 🟢 3. Filter by TSO ID (userId) - THIS WAS MISSING
      const tsoId = numberish(userId);
      if (tsoId !== undefined) {
        conditions.push(eq(masonPcSide.userId, tsoId));
      }

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // 🟢 4. Perform the Join
      const records = await db.select({
          ...getTableColumns(kycSubmissions),
          masonName: masonPcSide.name, 
          masonPhone: masonPcSide.phoneNumber,
          masonTsoId: masonPcSide.userId,
      })
      .from(kycSubmissions)
      .leftJoin(masonPcSide, eq(kycSubmissions.masonId, masonPcSide.id)) // 🟢 Join logic
      .where(whereCondition)
      .orderBy(desc(kycSubmissions.createdAt))
      .limit(parseInt(limit as string));

      res.json({ success: true, data: toJsonSafe(records) });
    } catch (error) {
      console.error(`Get ${tableName}s error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // --- GET BY ID ---
  // /api/kyc-submissions/:id (UUID)
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const [record] = await db.select({
          ...getTableColumns(kycSubmissions),
          masonName: masonPcSide.name,
      })
      .from(kycSubmissions)
      .leftJoin(masonPcSide, eq(kycSubmissions.masonId, masonPcSide.id))
      .where(eq(kycSubmissions.id, id))
      .limit(1);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `${tableName} not found`
        });
      }

      res.json({ success: true, data: toJsonSafe(record) });
    } catch (error) {
      console.error(`Get ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ KYC Submissions GET endpoints setup complete');
}