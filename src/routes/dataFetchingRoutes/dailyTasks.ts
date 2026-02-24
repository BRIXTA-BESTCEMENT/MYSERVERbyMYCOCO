// server/src/routes/dataFetchingRoutes/dailyTasks.ts 
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { dailyTasks, insertDailyTaskSchema } from '../../db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { z } from 'zod';

function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: any,
  schema: z.ZodSchema,
  tableName: string,
  autoFields?: { [key: string]: () => any },
  dateField?: string
}) {
  const { endpoint, table, schema, tableName, autoFields = {}, dateField } = config;

  // 1. GET ALL - Updated to match new schema fields
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { 
        startDate, endDate, limit = '50', status, 
        userId, visitType, dealerId, pjpBatchId, zone, week, ...filters 
      } = req.query;

      let whereCondition: any = undefined;

      if (startDate && endDate && dateField && table[dateField]) {
        whereCondition = and(
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      if (status) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(table.status, status as string))
          : eq(table.status, status as string);
      }

      if (userId) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(table.userId, parseInt(userId as string)))
          : eq(table.userId, parseInt(userId as string));
      }

      if (visitType) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(table.visitType, visitType as string))
          : eq(table.visitType, visitType as string);
      }

      // ✅ NEW: Replaced relatedDealerId with dealerId
      if (dealerId) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(table.dealerId, dealerId as string))
          : eq(table.dealerId, dealerId as string);
      }

      // ✅ NEW: Replaced pjpId with pjpBatchId
      if (pjpBatchId) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(table.pjpBatchId, pjpBatchId as string))
          : eq(table.pjpBatchId, pjpBatchId as string);
      }

      // ✅ NEW: Added filtering for zone and week
      if (zone) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(table.zone, zone as string))
          : eq(table.zone, zone as string);
      }
      
      if (week) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(table.week, week as string))
          : eq(table.week, week as string);
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value && table[key]) {
          whereCondition = whereCondition
            ? and(whereCondition, eq(table[key], value))
            : eq(table[key], value);
        }
      });

      let query:any = db.select().from(table);
      if (whereCondition) {
        query = query.where(whereCondition);
      }

      const orderField = table[dateField as any] || table.createdAt;
      const records = await query
        .orderBy(desc(orderField))
        .limit(parseInt(limit as string));

      res.json({ success: true, data: records });
    } catch (error) {
      console.error(`Get ${tableName}s error:`, error);
      res.status(500).json({ success: false, error: `Failed to fetch ${tableName}s` });
    }
  });

  // 2. GET BY User ID (This is the one your Flutter app hits)
  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, limit = '50', status, visitType } = req.query;

      let whereCondition:any = eq(table.userId, parseInt(userId));

      if (startDate && endDate && dateField && table[dateField]) {
        whereCondition = and(
          whereCondition,
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      if (status) {
        whereCondition = and(whereCondition, eq(table.status, status as string));
      }
      if (visitType) {
        whereCondition = and(whereCondition, eq(table.visitType, visitType as string));
      }

      const orderField = table[dateField as any] || table.createdAt;
      const records = await db.select().from(table)
        .where(whereCondition)
        .orderBy(desc(orderField))
        .limit(parseInt(limit as string));

      res.json({ success: true, data: records });
    } catch (error) {
      console.error(`Get ${tableName}s by User error:`, error);
      res.status(500).json({ success: false, error: `Failed to fetch ${tableName}s` });
    }
  });

  // 3. GET BY ID
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);

      if (!record) {
        return res.status(404).json({ success: false, error: `${tableName} not found` });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      console.error(`Get ${tableName} error:`, error);
      res.status(500).json({ success: false, error: `Failed to fetch ${tableName}` });
    }
  });

  // 4. GET BY Status - Removed assignedByUserId reference
  app.get(`/api/${endpoint}/status/:status`, async (req: Request, res: Response) => {
    try {
      const { status } = req.params;
      const { startDate, endDate, limit = '50', userId } = req.query;

      let whereCondition:any = eq(table.status, status);

      if (startDate && endDate && dateField && table[dateField]) {
        whereCondition = and(
          whereCondition,
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      if (userId) {
        whereCondition = and(whereCondition, eq(table.userId, parseInt(userId as string)));
      }

      const orderField = table[dateField as any] || table.createdAt;
      const records = await db.select().from(table)
        .where(whereCondition)
        .orderBy(desc(orderField))
        .limit(parseInt(limit as string));

      res.json({ success: true, data: records });
    } catch (error) {
      console.error(`Get ${tableName}s by Status error:`, error);
      res.status(500).json({ success: false, error: `Failed to fetch ${tableName}s` });
    }
  });
}

export default function setupDailyTasksRoutes(app: Express) {
  createAutoCRUD(app, {
    endpoint: 'daily-tasks',
    table: dailyTasks,
    schema: insertDailyTaskSchema,
    tableName: 'Daily Task',
    dateField: 'taskDate',
    autoFields: {
      taskDate: () => new Date().toISOString().split('T')[0], 
      status: () => 'Assigned' 
    }
  });
  
  console.log('✅ Daily Tasks GET endpoints setup complete');
}