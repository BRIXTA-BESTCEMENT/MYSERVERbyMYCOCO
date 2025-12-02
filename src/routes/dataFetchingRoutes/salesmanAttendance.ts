//  server/src/routes/dataFetchingRoutes/salesmanAttendance.ts 
// Salesman Attendance GET endpoints using createAutoCRUD pattern

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { salesmanAttendance, insertSalesmanAttendanceSchema } from '../../db/schema';
// --- ✅ Added SQL import for type safety ---
import { eq, and, desc, gte, lte, SQL } from 'drizzle-orm'; 
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

  // GET ALL - with optional filtering and date range
  app.get(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, limit = '50', userId, ...filters } = req.query;

      let whereCondition: any = undefined;

      // Date range filtering using attendanceDate
      if (startDate && endDate && dateField && table[dateField]) {
        whereCondition = and(
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      // Filter by userId
      if (userId) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(table.userId, parseInt(userId as string)))
          : eq(table.userId, parseInt(userId as string));
      }

      // Additional filters (Handles 'role' automatically if passed in query)
      Object.entries(filters).forEach(([key, value]) => {
        if (value && table[key]) {
          if (key === 'userId') {
            whereCondition = whereCondition
              ? and(whereCondition, eq(table[key], parseInt(value as string)))
              : eq(table[key], parseInt(value as string));
          } else {
            whereCondition = whereCondition
              ? and(whereCondition, eq(table[key], value))
              : eq(table[key], value);
          }
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
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET BY User ID
  app.get(`/api/${endpoint}/user/:userId`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      // --- ✅ Extract role from query ---
      const { startDate, endDate, limit = '50', role } = req.query;

      let whereCondition:any = eq(table.userId, parseInt(userId));

      // Date range filtering
      if (startDate && endDate && dateField && table[dateField]) {
        whereCondition = and(
          whereCondition,
          gte(table[dateField], startDate as string),
          lte(table[dateField], endDate as string)
        );
      }

      // --- ✅ Filter by Role if provided ---
      if (role) {
        whereCondition = and(whereCondition, eq(table.role, String(role)));
      }

      const orderField = table[dateField as any] || table.createdAt;
      const records = await db.select().from(table)
        .where(whereCondition)
        .orderBy(desc(orderField))
        .limit(parseInt(limit as string));

      res.json({ success: true, data: records });
    } catch (error) {
      console.error(`Get ${tableName}s by User error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}s`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET BY ID
  app.get(`/api/${endpoint}/:id`, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `${tableName} not found`
        });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      console.error(`Get ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET Today's Attendance by User
  app.get(`/api/${endpoint}/user/:userId/today`, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { role } = req.query; // ✅ Get role from query params
      const today = new Date().toISOString().split('T')[0];

      // --- ✅ 1. Define conditions array ---
      const conditions: SQL[] = [
        eq(table.userId, parseInt(userId)),
        eq(table.attendanceDate, today)
      ];

      // --- ✅ 2. Add role condition if provided ---
      if (role) {
        conditions.push(eq(table.role, String(role)));
      }

      // --- ✅ 3. Execute query with all conditions applied ---
      const [record] = await db.select().from(table)
        .where(and(...conditions))
        .limit(1);

      if (!record) {
        return res.status(404).json({
          success: false,
          error: `No attendance record found for today`
        });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      console.error(`Get today's ${tableName} error:`, error);
      res.status(500).json({
        success: false,
        error: `Failed to fetch today's ${tableName}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

}

// Function call in the same file
export default function setupSalesmanAttendanceRoutes(app: Express) {
  // Salesman Attendance - date field for filtering
  createAutoCRUD(app, {
    endpoint: 'attendance',
    table: salesmanAttendance,
    schema: insertSalesmanAttendanceSchema,
    tableName: 'Attendance',
    dateField: 'attendanceDate',
    autoFields: {
      attendanceDate: () => new Date().toISOString().split('T')[0] // date type
    }
  });
  
  console.log('✅ Salesman Attendance GET endpoints setup complete');
}