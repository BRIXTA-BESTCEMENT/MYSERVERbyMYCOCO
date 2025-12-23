// server/src/routes/updateRoutes/pjp.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { permanentJourneyPlans } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// helpers
const toDateOnly = (d: Date) => d.toISOString().slice(0, 10); 

const strOrNull = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return null;
  return String(val).trim();
}, z.string().nullable().optional());

const numOrZero = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}, z.number().int().optional());

// --- PATCH schema UPDATED for all new fields ---
const pjpPatchSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  createdById: z.coerce.number().int().positive().optional(),
  dealerId: strOrNull, 
  siteId: strOrNull,  
  planDate: z.coerce.date().optional(),
  areaToBeVisited: z.string().max(500).optional(),
  route: strOrNull, // Added
  description: z.string().max(500).optional().nullable(), 
  status: z.string().max(50).optional(),
  
  // Numerical Metrics
  plannedNewSiteVisits: numOrZero,
  plannedFollowUpSiteVisits: numOrZero,
  plannedNewDealerVisits: numOrZero,
  plannedInfluencerVisits: numOrZero,
  noOfConvertedBags: numOrZero,
  noOfMasonPcSchemes: numOrZero,

  // Influencer Data
  influencerName: strOrNull,
  influencerPhone: strOrNull,
  activityType: strOrNull,
  diversionReason: strOrNull,

  verificationStatus: z.string().max(50).optional().nullable(),
  additionalVisitRemarks: z.string().max(500).optional().nullable(),
}).strict();

export default function setupPjpPatchRoutes(app: Express) {
  app.patch('/api/pjp/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const input = pjpPatchSchema.parse(req.body);

      if (Object.keys(input).length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      const [existing] = await db
        .select({ id: permanentJourneyPlans.id })
        .from(permanentJourneyPlans)
        .where(eq(permanentJourneyPlans.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: `PJP with ID '${id}' not found.`,
        });
      }

      // 3) build patch safely
      const patch: any = { updatedAt: new Date() }; // always touch updatedAt

      if (input.userId !== undefined) patch.userId = input.userId;
      if (input.createdById !== undefined) patch.createdById = input.createdById;
      
      if (input.dealerId !== undefined) patch.dealerId = input.dealerId;
      if (input.siteId !== undefined) patch.siteId = input.siteId;

      if (input.planDate !== undefined) patch.planDate = toDateOnly(input.planDate);
      if (input.areaToBeVisited !== undefined) patch.areaToBeVisited = input.areaToBeVisited;
      if (input.route !== undefined) patch.route = input.route;
      if (input.status !== undefined) patch.status = input.status;
      
      if (input.description !== undefined) patch.description = input.description;
      if (input.verificationStatus !== undefined) patch.verificationStatus = input.verificationStatus;
      if (input.additionalVisitRemarks !== undefined) patch.additionalVisitRemarks = input.additionalVisitRemarks;
      
      if (input.plannedNewSiteVisits !== undefined) patch.plannedNewSiteVisits = input.plannedNewSiteVisits;
      if (input.plannedFollowUpSiteVisits !== undefined) patch.plannedFollowUpSiteVisits = input.plannedFollowUpSiteVisits;
      if (input.plannedNewDealerVisits !== undefined) patch.plannedNewDealerVisits = input.plannedNewDealerVisits;
      if (input.plannedInfluencerVisits !== undefined) patch.plannedInfluencerVisits = input.plannedInfluencerVisits;
      if (input.noOfConvertedBags !== undefined) patch.noOfConvertedBags = input.noOfConvertedBags;
      if (input.noOfMasonPcSchemes !== undefined) patch.noOfMasonPcSchemes = input.noOfMasonPcSchemes;

      if (input.influencerName !== undefined) patch.influencerName = input.influencerName;
      if (input.influencerPhone !== undefined) patch.influencerPhone = input.influencerPhone;
      if (input.activityType !== undefined) patch.activityType = input.activityType;
      if (input.diversionReason !== undefined) patch.diversionReason = input.diversionReason;
      
      // 4) update
      const [updated] = await db
        .update(permanentJourneyPlans)
        .set(patch)
        .where(eq(permanentJourneyPlans.id, id))
        .returning();

      return res.json({
        success: true,
        message: 'Permanent Journey Plan updated successfully',
        data: updated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
      }
      console.error('Update PJP error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update PJP',
      });
    }
  });

  console.log('✅ PJP PATCH endpoints (dealerId + siteId) setup complete');
}