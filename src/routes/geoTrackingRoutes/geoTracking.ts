// server/src/routes/geoTrackingRoutes/geoTracking.ts

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { geoTracking, insertGeoTrackingSchema } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import crypto from "crypto";

// Create a partial schema for PATCH validation.
const geoTrackingUpdateSchema = insertGeoTrackingSchema.partial();

export default function setupGeoTrackingRoutes(app: Express) {

  // -------------------------
  // GET Endpoints
  // -------------------------

  // GET all tracking points for a specific user
  app.get('/api/geotracking/user/:userId', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: 'Invalid user ID.' });
      }

      const records = await db.select()
        .from(geoTracking)
        .where(eq(geoTracking.userId, userId))
        .orderBy(desc(geoTracking.recordedAt));

      res.json({ success: true, data: records });
    } catch (error) {
      console.error('Get Geo-tracking by User ID error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch tracking data.' });
    }
  });

  // GET all tracking points for a specific journey
  app.get('/api/geotracking/journey/:journeyId', async (req: Request, res: Response) => {
    try {
      const { journeyId } = req.params;

      const records = await db.select()
        .from(geoTracking)
        .where(eq(geoTracking.journeyId, journeyId))
        .orderBy(desc(geoTracking.recordedAt));

      res.json({ success: true, data: records });
    } catch (error) {
      console.error('Get Geo-tracking by Journey ID error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch journey data.' });
    }
  });

  // GET latest tracking point for a specific user
  app.get('/api/geotracking/user/:userId/latest', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: 'Invalid user ID.' });
      }

      const [latest] = await db.select()
        .from(geoTracking)
        .where(eq(geoTracking.userId, userId))
        .orderBy(desc(geoTracking.recordedAt))
        .limit(1);

      if (!latest) {
        return res.json({ success: true, data: null });
      }

      const normalized = {
        ...latest,
        recordedAt: latest.recordedAt instanceof Date ? latest.recordedAt.toISOString() : latest.recordedAt,
      };

      return res.json({ success: true, data: normalized });
    } catch (err) {
      console.error('Get latest geo-tracking by User ID error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch latest tracking data.' });
    }
  });

  // -------------------------
  // POST Endpoint (FIXED)
  // -------------------------

  app.post('/api/geotracking', async (req: Request, res: Response) => {
    console.log("🔥 RAW BODY RECEIVED:", JSON.stringify(req.body, null, 2));
    try {
      // 0) Defensive deep clone
      const incomingRaw = JSON.parse(JSON.stringify(req.body || {})) as Record<string, any>;

      // 1) Remove id/uuid keys
      for (const badKey of ['id', 'ID', 'Id', '_id', 'uuid', 'UUID', 'Uuid']) {
        if (badKey in incomingRaw) delete incomingRaw[badKey];
      }

      // 2) Coerce numeric fields to strings (Postgres 'numeric' types)
      const COERCE_TO_STRING_KEYS = [
        'latitude', 'longitude',
        'dest_lat', 'dest_lng', 'destLat', 'destLng',
        'total_distance_travelled', 'totalDistanceTravelled',
        'accuracy', 'speed', 'heading', 'altitude', 'battery_level', 'batteryLevel'
      ];

      for (const key of COERCE_TO_STRING_KEYS) {
        if (key in incomingRaw && typeof incomingRaw[key] === 'number') {
          incomingRaw[key] = incomingRaw[key].toString();
        }
      }

      // 3) Validate with Zod
      // Note: We allow passthrough so we can manually grab extra fields if Zod is outdated
      const parsed = insertGeoTrackingSchema.passthrough().safeParse(incomingRaw);

      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid body', details: parsed.error.flatten() });
      }
      const data = parsed.data as Record<string, any>;

      const now = new Date();

      // 4) Map ALL schema fields
      // We prioritize incomingRaw for fields that might be stripped by Zod if the schema is stale
      const payload: Record<string, any> = {
        id: crypto.randomUUID(),
        userId: data.userId ?? data.user_id,

        // Coords
        latitude: data.latitude,
        longitude: data.longitude,

        // Metadata
        accuracy: data.accuracy,
        speed: data.speed,
        heading: data.heading,
        altitude: data.altitude,

        // Status & Journey
        journeyId: data.journeyId ?? data.journey_id,
        isActive: data.isActive ?? data.is_active ?? true,
        locationType: data.locationType ?? data.location_type,
        activityType: data.activityType ?? data.activity_type,
        appState: data.appState ?? data.app_state,

        // Device Health
        batteryLevel: data.batteryLevel ?? data.battery_level,
        isCharging: data.isCharging ?? data.is_charging,
        networkStatus: data.networkStatus ?? data.network_status,
        ipAddress: data.ipAddress ?? data.ip_address,

        // Site / Destination
        siteName: data.siteName ?? data.site_name,
        // ✅ CRITICAL FIX: Read from incomingRaw directly to bypass Zod stripping
        siteId: incomingRaw.siteId ?? incomingRaw.site_id ?? data.siteId ?? data.site_id,

        destLat: data.destLat ?? data.dest_lat,
        destLng: data.destLng ?? data.dest_lng,
        totalDistanceTravelled: data.totalDistanceTravelled ?? data.total_distance_travelled,

        // Times
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : now,
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : null,
        checkOutTime: data.checkOutTime ? new Date(data.checkOutTime) : null,

        createdAt: now,
        updatedAt: now,
      };

      // 5) Clean payload (remove undefined/null/empty)
      for (const k of Object.keys(payload)) {
        if (payload[k] === undefined || payload[k] === null || payload[k] === '') delete payload[k];
      }

      console.log('🔁 FINAL INSERT PAYLOAD:', payload);

      // 6) Insert (Type cast as any to avoid TS partial match errors)
      const [inserted] = await db.insert(geoTracking).values(payload as any).returning();

      return res.status(201).json({ success: true, data: inserted });

    } catch (err: any) {
      if (err?.issues) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: err.issues });
      }
      console.error('[geotracking] error', err);
      // Handle Foreign Key errors (e.g. invalid siteId)
      if (err?.code === '23503') {
        return res.status(400).json({ success: false, error: 'Invalid User ID or Site ID provided (Foreign Key Violation).' });
      }
      return res.status(500).json({ success: false, error: 'Failed to create tracking point', details: err?.message });
    }
  });

  // -------------------------
  // PATCH Endpoint

  // -------------------------
  // PATCH Endpoint (Fixes Numbers AND Dates)
  // -------------------------

  app.patch('/api/geotracking/:id', async (req: Request, res: Response) => {
    console.log("RAW PATCH BODY RECEIVED:", JSON.stringify(req.body, null, 2));

    try {
      const { id } = req.params;

      // 0) Defensive Copy
      const incomingRaw = JSON.parse(JSON.stringify(req.body || {})) as Record<string, any>;

      // 1) Coerce numeric fields to strings (Postgres numeric types)
      const COERCE_TO_STRING_KEYS = [
        'latitude', 'longitude',
        'dest_lat', 'dest_lng', 'destLat', 'destLng',
        'total_distance_travelled', 'totalDistanceTravelled',
        'accuracy', 'speed', 'heading', 'altitude', 'battery_level', 'batteryLevel'
      ];

      for (const key of COERCE_TO_STRING_KEYS) {
        if (key in incomingRaw && typeof incomingRaw[key] === 'number') {
          incomingRaw[key] = incomingRaw[key].toString();
        }
      }

      // 2) ✅ CRITICAL FIX: Coerce Date fields from String -> Date Object
      const DATE_KEYS = ['recordedAt', 'checkInTime', 'checkOutTime'];

      for (const key of DATE_KEYS) {
        if (incomingRaw[key] && typeof incomingRaw[key] === 'string') {
          // If it's a valid ISO string, convert to Date object for Zod/Drizzle
          const d = new Date(incomingRaw[key]);
          if (!isNaN(d.getTime())) {
            incomingRaw[key] = d;
          }
        }
      }

      // 3) Validate with Zod
      const validatedData = geoTrackingUpdateSchema.parse(incomingRaw);

      if (Object.keys(validatedData).length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update were provided.' });
      }

      const [existingRecord] = await db.select().from(geoTracking).where(eq(geoTracking.id, id)).limit(1);

      if (!existingRecord) {
        return res.status(404).json({ success: false, error: `Tracking record with ID '${id}' not found.` });
      }

      const [updatedRecord] = await db
        .update(geoTracking)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(geoTracking.id, id))
        .returning();

      console.log("✅ PATCH SUCCESS:", updatedRecord); // Debug log

      res.json({ success: true, message: 'Tracking record updated successfully', data: updatedRecord });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ Validation Error:", JSON.stringify(error.issues, null, 2));
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
      }
      console.error('Update Geo-tracking error:', error);
      res.status(500).json({ success: false, error: 'Failed to update tracking record.' });
    }
  });
}