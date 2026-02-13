// src/routes/dataFetchingRoutes/logisticsIO.ts
import { Express, Request, Response } from "express";
import { db } from '../../db/db';
import { logisticsIO } from "../../db/schema";
import { desc, eq, ilike, and, sql, gte, lte, or } from "drizzle-orm";

export default function setupLogisticsIORoutes(app: Express) {
  
  app.get("/api/logistics-io", async (req: Request, res: Response) => {
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

      // 1. Search Logic (Zone, District, Destination, ID, Party Name, Vehicle Number)
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(
          or(
            ilike(logisticsIO.zone, searchTerm),
            ilike(logisticsIO.district, searchTerm),
            ilike(logisticsIO.destination, searchTerm),
            ilike(logisticsIO.id, searchTerm),
            ilike(logisticsIO.partyName, searchTerm),      // Added new field to search
            ilike(logisticsIO.vehicleNumber, searchTerm)   // Added new field to search
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
            gte(logisticsIO.createdAt, start),
            lte(logisticsIO.createdAt, end)
          )
        );
      }

      // 3. Specific Column Filters
      if (zone) {
        conditions.push(eq(logisticsIO.zone, zone as string));
      }
      
      if (district) {
        conditions.push(eq(logisticsIO.district, district as string));
      }

      // 4. Execute Queries (Data + Count)
      const dataQuery = db
        .select()
        .from(logisticsIO)
        .where(and(...conditions))
        .limit(limitNumber)
        .offset(offset)
        .orderBy(desc(logisticsIO.createdAt));

      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(logisticsIO)
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