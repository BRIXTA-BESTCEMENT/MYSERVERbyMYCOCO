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
import { InferInsertModel, eq } from 'drizzle-orm';

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

    // Optional arrays for Many-to-Many
    associatedMasonIds: z.array(z.string()).optional(),
    associatedDealerIds: z.array(z.string()).optional(),

    // Optional Radius for Geofence (defaulting to 25 if not provided)
    radius: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(10).max(10000).optional()),
  });

  app.post('/api/technical-sites', async (req: Request, res: Response) => {
    try {
      // 0. Safety Check
      if (!process.env.RADAR_SECRET_KEY) {
        return res.status(500).json({ success: false, error: 'RADAR_SECRET_KEY is not configured on the server' });
      }

      const parsed = extendedSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: parsed.error.errors
        });
      }

      const {
        associatedMasonIds = [], 
        associatedDealerIds = [],
        radius = 25, // Default radius
        ...siteData
      } = parsed.data;

      // Ensure we have coordinates for Radar
      // If your app strictly requires Geofencing, uncomment the block below:
      /*
      if (!siteData.latitude || !siteData.longitude) {
         return res.status(400).json({ success: false, error: 'Latitude and Longitude are required for geofencing.' });
      }
      */

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

      // 2. TRANSACTION (DB Insert)
      const siteResult = await db.transaction(async (tx) => {
        // Step A: Insert Site
        const [insertedSite] = await tx
          .insert(technicalSites)
          .values(insertData as any)
          .returning();

        // Step B: Insert Masons
        if (associatedMasonIds.length > 0) {
          const uniqueMasons = [...new Set(associatedMasonIds)];
          const masonMaps = uniqueMasons.map((masonId) => ({
            A: masonId,
            B: insertedSite.id,
          }));
          await tx.insert(siteAssociatedMasons).values(masonMaps);
        }

        // Step C: Insert Dealers
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

      // 3. RADAR UPSERT (Geofencing)
      // Only attempt if coordinates exist
      let geofenceData = null;
      
      const latVal = parseFloat(siteResult.latitude as string);
      const lngVal = parseFloat(siteResult.longitude as string);

      if (!isNaN(latVal) && !isNaN(lngVal)) {
        try {
          const tag = 'site';
          const externalId = `site:${siteResult.id}`;
          const radarUrl = `https://api.radar.io/v1/geofences/${encodeURIComponent(tag)}/${encodeURIComponent(externalId)}`;

          const description =String(siteResult.siteName ?? `Site ${siteResult.id}`).slice(0, 120);

          const form = new URLSearchParams();
          form.set('description', description);
          form.set('type', 'circle');
          form.set('coordinates', JSON.stringify([lngVal, latVal])); // [lng, lat]
          form.set('radius', String(radius));

          // Metadata: Mapped strictly to your technicalSites schema
          const metadata: Record<string, any> = {
            siteId: siteResult.id,
            siteType: siteResult.siteType,
            region: siteResult.region,
            area: siteResult.area,
            phoneNo: siteResult.phoneNo, 
          };

          // Clean nulls
          Object.keys(metadata).forEach(k => metadata[k] == null && delete metadata[k]);
          if (Object.keys(metadata).length) form.set('metadata', JSON.stringify(metadata));

          const upRes = await fetch(radarUrl, {
            method: 'PUT',
            headers: {
              Authorization: process.env.RADAR_SECRET_KEY as string,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
          });

          const upJson = await upRes.json().catch(() => ({} as any));

          if (!upRes.ok || upJson?.meta?.code !== 200 || !upJson?.geofence) {
            // --- ROLLBACK: Delete from DB if Radar fails ---
            console.error('Radar Upsert Failed, Rolling back DB:', upJson);
            await db.delete(technicalSites).where(eq(technicalSites.id, siteResult.id));
            
            return res.status(502).json({
              success: false,
              error: upJson?.meta?.message || upJson?.message || 'Failed to upsert site geofence in Radar',
              details: 'Database insert was rolled back to maintain consistency.'
            });
          }

          geofenceData = {
            id: upJson.geofence._id,
            tag: upJson.geofence.tag,
            externalId: upJson.geofence.externalId,
            radiusMeters: upJson.geofence.geometryRadius ?? radius,
          };

        } catch (radarError) {
          // Network error or logic error during fetch
          console.error('Radar Network Error, Rolling back DB:', radarError);
          await db.delete(technicalSites).where(eq(technicalSites.id, siteResult.id));
          throw radarError; // Pass to main catch block
        }
      }

      // 4. Success Response
      res.status(201).json({
        success: true,
        message: 'Technical Site created and geofence upserted',
        data: siteResult,
        geofenceRef: geofenceData
      });

    } catch (error: any) {
      console.error('Create Technical Site Error:', error);

      const msg = String(error?.message ?? '').toLowerCase();
      if (error?.code === '23503' || msg.includes('violates foreign key constraint')) {
        return res.status(400).json({
          success: false,
          error: 'One of the provided IDs (Dealer/Mason/User) does not exist.'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create Technical Site',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Technical Sites POST endpoint ready (Hybrid Old+New Support + Radar)');
}