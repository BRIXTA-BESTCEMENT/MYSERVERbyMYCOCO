// src/routes/dataFetchingRoutes/logisticsGateIO.ts
import { Express, Request, Response } from "express";
import { db } from '../../db/db';
import { logisticsGateIO } from "../../db/schema";
import { desc, eq, ilike, and, sql, gte, lte, or } from "drizzle-orm";

export default function setupLogisticsGateIORoutes(app: Express) {
  
  app.get("/api/logistics-gate-io", async (req: Request, res: Response) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        startDate, 
        endDate,
        zone,
        district 
      } = req.query;

      const pageNumber = parseInt(page as string);
      const limitNumber = parseInt(limit as string);
      const offset = (pageNumber - 1) * limitNumber;

      const conditions = [];

      // 1. Search Logic (Zone, District, Destination, ID)
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(
          or(
            ilike(logisticsGateIO.zone, searchTerm),
            ilike(logisticsGateIO.district, searchTerm),
            ilike(logisticsGateIO.destination, searchTerm),
            ilike(logisticsGateIO.id, searchTerm)
          )
        );
      }

      // 2. Date Range Filter
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        // Ensure the end date covers the entire day
        end.setHours(23, 59, 59, 999);

        conditions.push(
          and(
            gte(logisticsGateIO.createdAt, start),
            lte(logisticsGateIO.createdAt, end)
          )
        );
      }

      // 3. Specific Column Filters
      if (zone) {
        conditions.push(eq(logisticsGateIO.zone, zone as string));
      }
      
      if (district) {
        conditions.push(eq(logisticsGateIO.district, district as string));
      }

      // 4. Execute Queries (Data + Count)
      const dataQuery = db
        .select()
        .from(logisticsGateIO)
        .where(and(...conditions))
        .limit(limitNumber)
        .offset(offset)
        .orderBy(desc(logisticsGateIO.createdAt));

      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(logisticsGateIO)
        .where(and(...conditions));

      const [data, totalCountResult] = await Promise.all([
        dataQuery,
        countQuery,
      ]);

      const total = Number(totalCountResult[0]?.count || 0);
      const totalPages = Math.ceil(total / limitNumber);

      res.status(200).json({
        data,
        total,
        page: pageNumber,
        totalPages,
        limit: limitNumber
      });

    } catch (error) {
      console.error("Error fetching logistics data:", error);
      res.status(500).json({ error: "Failed to fetch logistics data" });
    }
  });
}