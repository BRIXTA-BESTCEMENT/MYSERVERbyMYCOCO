// server/src/routes/postRoutes/technicalSites.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import {
  technicalSites,
  insertTechnicalSiteSchema,
  siteAssociatedMasons,
  siteAssociatedDealers
} from '../../db/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { InferInsertModel } from 'drizzle-orm';

type TechnicalSiteInsert = InferInsertModel<typeof technicalSites>;

export default function setupTechnicalSitesPostRoutes(app: Express) {

  // 1. HYBRID SCHEMA: Supports both Old (Single) and New (Array) inputs
  const extendedSchema = insertTechnicalSiteSchema.extend({
    // Coerce numbers from Flutter to strings/decimals
    latitude: z.coerce.string().optional(),
    longitude: z.coerce.string().optional(),

    // Coerce dates safely (Flutter sends ISO strings)
    constructionStartDate: z.coerce.date().optional(),
    constructionEndDate: z.coerce.date().optional(),
    firstVistDate: z.coerce.date().optional(),
    lastVisitDate: z.coerce.date().optional(),

    // NEW: Optional arrays for Many-to-Many
    associatedMasonIds: z.array(z.string()).optional(),
    associatedDealerIds: z.array(z.string()).optional(),
  });

  app.post('/api/technical-sites', async (req: Request, res: Response) => {
    try {
      const parsed = extendedSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parsed.error.errors
        });
      }

      const {
        associatedMasonIds = [], // Default to empty array
        associatedDealerIds = [],
        ...siteData
      } = parsed.data;

      const newSiteId = randomUUID();

      // Explicit date handling for Drizzle
      const insertData: TechnicalSiteInsert = {
        ...siteData,
        id: newSiteId,
        constructionStartDate: siteData.constructionStartDate ? siteData.constructionStartDate.toISOString() : null,
        constructionEndDate: siteData.constructionEndDate ? siteData.constructionEndDate.toISOString() : null,
        firstVistDate: siteData.firstVistDate ? siteData.firstVistDate.toISOString() : null,
        lastVisitDate: siteData.lastVisitDate ? siteData.lastVisitDate.toISOString() : null,
        imageUrl: siteData.imageUrl ?? null,
      };

      // 2. TRANSACTION
      const result = await db.transaction(async (tx) => {
        // Step A: Insert Site (With Single IDs if provided)
        const [insertedSite] = await tx
          .insert(technicalSites)
          .values(insertData as any)
          .returning();

        // Step B: Insert Masons (New + Old merged)
        if (associatedMasonIds.length > 0) {
          // Deduplicate just in case
          const uniqueMasons = [...new Set(associatedMasonIds)];
          const masonMaps = uniqueMasons.map((masonId) => ({
            A: masonId,
            B: insertedSite.id,
          }));
          await tx.insert(siteAssociatedMasons).values(masonMaps);
        }

        // Step C: Insert Dealers (New + Old merged)
        if (associatedDealerIds.length > 0) {
          const uniqueDealers = [...new Set(associatedDealerIds)];
          const dealerMaps = uniqueDealers.map((dealerId) => ({
            A: dealerId,
            B: insertedSite.id,
          }));
          await tx.insert(siteAssociatedDealers).values(dealerMaps);
        }

        return insertedSite;
      });

      res.status(201).json({
        success: true,
        message: 'Technical Site created successfully',
        data: result,
      });

    } catch (error: any) {
      console.error('Create Technical Site Error:', error);

      const msg = String(error?.message ?? '').toLowerCase();
      if (error?.code === '23503' || msg.includes('violates foreign key constraint')) {
        return res.status(400).json({
          success: false,
          error: 'One of the provided IDs (Dealer/Mason) does not exist.'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create Technical Site',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Technical Sites POST endpoint ready (Hybrid Old+New Support)');
}