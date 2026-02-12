// server/src/routes/dataFetchingRoutes/collectionReports.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { collectionReports } from '../../db/schema';
import { eq, and, desc, gte, lte, SQL } from 'drizzle-orm';
import { z } from 'zod';

/* =========================================================
   1. VALIDATION SCHEMAS
   (Strictly for GET Query Params - Not for DB Inserts)
========================================================= */
export const getCollectionReportQuerySchema = z.object({
  institution: z.enum(['JUD', 'JSB']).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dealerId: z.string().optional(),
  salesPromoterUserId: z.coerce.number().optional(),
  limit: z.coerce.number().default(50),
});

/* =========================================================
   2. ROUTE DEFINITIONS
========================================================= */
export default function setupCollectionReportsRoutes(app: Express) {
  
  const ENDPOINT = 'collection-reports';
  const TABLE_NAME = 'Collection Report';

  // -------------------------------------------------------
  // GET ALL (With Filters)
  // -------------------------------------------------------
  app.get(`/api/${ENDPOINT}`, async (req: Request, res: Response) => {
    try {
      // 1. Validate Query Params using Zod
      const query = getCollectionReportQuerySchema.parse(req.query);
      const { institution, fromDate, toDate, dealerId, salesPromoterUserId, limit } = query;

      // 2. Build Dynamic Filters
      const filters: SQL[] = [];

      // Filter: Date Range (using voucherDate)
      if (fromDate) filters.push(gte(collectionReports.voucherDate, fromDate));
      if (toDate) filters.push(lte(collectionReports.voucherDate, toDate));

      // Filter: Institution (JUD | JSB)
      if (institution) filters.push(eq(collectionReports.institution, institution));

      // Filter: Dealer
      if (dealerId) filters.push(eq(collectionReports.dealerId, dealerId));

      // Filter: Sales Promoter (User ID)
      if (salesPromoterUserId) {
        filters.push(eq(collectionReports.salesPromoterUserId, salesPromoterUserId));
      }

      // 3. Execute Query
      const records = await db
        .select()
        .from(collectionReports)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(collectionReports.voucherDate)) // Newest first
        .limit(limit);

      res.json({ success: true, count: records.length, data: records });

    } catch (error) {
      console.error(`Get ${TABLE_NAME}s error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${TABLE_NAME}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // -------------------------------------------------------
  // GET BY ID (Single Record)
  // -------------------------------------------------------
  app.get(`/api/${ENDPOINT}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Validate UUID format prevents DB errors
      const uuidSchema = z.string().uuid();
      const validId = uuidSchema.safeParse(id);

      if (!validId.success) {
        return res.status(400).json({ success: false, error: "Invalid ID format" });
      }

      const [record] = await db
        .select()
        .from(collectionReports)
        .where(eq(collectionReports.id, id))
        .limit(1);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `${TABLE_NAME} not found`
        });
      }

      res.json({ success: true, data: record });

    } catch (error) {
      console.error(`Get ${TABLE_NAME} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${TABLE_NAME}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // -------------------------------------------------------
  // GET BY SALES PROMOTER (User Context)
  // -------------------------------------------------------
  app.get(`/api/${ENDPOINT}/user/:userId`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { fromDate, toDate, limit = '50', institution } = req.query;

      const salesPromoterUserId = parseInt(userId);
      if (isNaN(salesPromoterUserId)) {
         return res.status(400).json({ success: false, error: "Invalid User ID" });
      }

      // Build specific filters for this user
      const filters: SQL[] = [
        eq(collectionReports.salesPromoterUserId, salesPromoterUserId)
      ];

      // Date Range
      if (fromDate && typeof fromDate === 'string') {
        filters.push(gte(collectionReports.voucherDate, fromDate));
      }
      if (toDate && typeof toDate === 'string') {
        filters.push(lte(collectionReports.voucherDate, toDate));
      }

      // Optional: Filter by Institution within User context
      if (institution && (institution === 'JUD' || institution === 'JSB')) {
        filters.push(eq(collectionReports.institution, institution));
      }

      const records = await db
        .select()
        .from(collectionReports)
        .where(and(...filters))
        .orderBy(desc(collectionReports.voucherDate))
        .limit(parseInt(limit as string));

      res.json({ success: true, count: records.length, data: records });

    } catch (error) {
      console.error(`Get ${TABLE_NAME}s by User error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${TABLE_NAME}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Collection Reports GET endpoints setup complete');
}