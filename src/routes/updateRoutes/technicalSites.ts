// server/src/routes/updateRoutes/technicalSites.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { 
  technicalSites, 
  siteAssociatedMasons, 
  siteAssociatedDealers 
} from '../../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// --- Helper Functions ---
const strOrNull = z.preprocess((val) => {
  if (val === '' || val === undefined) return null;
  if (val === null) return null;
  if (typeof val === 'string') {
    const t = val.trim();
    return t === '' ? null : t;
  }
  return String(val);
}, z.string().nullable().optional());

const dateOrNull = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}, z.date().nullable().optional());

const boolOrNull = z.preprocess((val) => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    if (val === '' || val === null || val === undefined) return null;
    return undefined; 
}, z.boolean().nullable().optional());

// --- Core Schema for Site Update ---
const technicalSiteBaseSchema = z.object({
  siteName: z.string().min(1).max(255).optional(),
  concernedPerson: z.string().min(1).max(255).optional(),
  phoneNo: z.string().min(1).max(20).optional(),
  address: strOrNull,
  latitude: z.coerce.string().optional(),
  longitude: z.coerce.string().optional(),
  siteType: strOrNull,
  area: strOrNull,
  region: strOrNull,

  keyPersonName: strOrNull,
  keyPersonPhoneNum: strOrNull,
  stageOfConstruction: strOrNull,
  
  // Date Handling
  constructionStartDate: dateOrNull,
  constructionEndDate: dateOrNull,
  firstVistDate: dateOrNull,
  lastVisitDate: dateOrNull,

  convertedSite: boolOrNull,
  needFollowUp: boolOrNull,
  imageUrl: strOrNull,
  // associatedMasonIds & associatedDealerIds are the only way to link now
  associatedMasonIds: z.array(z.string()).optional(), 
  associatedDealerIds: z.array(z.string()).optional(),
});

// Partial Schema for PATCH
const technicalSitePatchSchema = technicalSiteBaseSchema.partial();

// Date conversion helper for Drizzle
const toDrizzleDateValue = (d: Date | null | undefined): string | null => {
  if (!d) return null;
  return d.toISOString();
};

export default function setupTechnicalSitesUpdateRoutes(app: Express) {
  
  app.patch('/api/technical-sites/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const parsed = technicalSitePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.issues });
      }

      const input = parsed.data;

      // Check if site exists
      const [existingSite] = await db.select().from(technicalSites).where(eq(technicalSites.id, id)).limit(1);
      if (!existingSite) {
        return res.status(404).json({ success: false, error: `Technical Site with ID '${id}' not found.` });
      }

      // --- 1. Prepare Main Table Patch ---
      const patch: Record<string, any> = {};

      Object.keys(input).forEach(key => {
        // Skip array fields
        if (key === 'associatedMasonIds' || key === 'associatedDealerIds') return;

        const value = input[key as keyof typeof input];
        
        if (key.includes('Date')) {
            patch[key] = toDrizzleDateValue(value as Date | null | undefined);
        } else if (value !== undefined) {
            patch[key] = value;
        }
      });
      
      patch.updatedAt = new Date();

      // --- 2. TRANSACTION ---
      const result = await db.transaction(async (tx) => {
        
        // A. Update Main Table
        let updatedSite = existingSite;
        // Only run update if there are fields other than updatedAt
        if (Object.keys(patch).length > 1) { 
           [updatedSite] = await tx
            .update(technicalSites)
            .set(patch)
            .where(eq(technicalSites.id, id))
            .returning();
        }

        // B. Update Masons (Full Replace)
        if (input.associatedMasonIds !== undefined) {
          await tx.delete(siteAssociatedMasons).where(eq(siteAssociatedMasons.B, id));
          
          const masons = input.associatedMasonIds;
          if (masons.length > 0) {
            const unique = [...new Set(masons)];
            await tx.insert(siteAssociatedMasons).values(
              unique.map(mid => ({ A: mid, B: id }))
            );
          }
        }

        // C. Update Dealers (Full Replace)
        if (input.associatedDealerIds !== undefined) {
          await tx.delete(siteAssociatedDealers).where(eq(siteAssociatedDealers.B, id));
          
          const dealers = input.associatedDealerIds;
          if (dealers.length > 0) {
            const unique = [...new Set(dealers)];
            await tx.insert(siteAssociatedDealers).values(
              unique.map(did => ({ A: did, B: id }))
            );
          }
        }

        return updatedSite;
      });

      return res.json({
        success: true,
        message: 'Technical Site updated successfully',
        data: result,
      });

    } catch (error) {
      console.error('Update Technical Site error:', error);
      const msg = String((error as any)?.message ?? '').toLowerCase();
      
      if (msg.includes('violates foreign key constraint')) {
         return res.status(400).json({ success: false, error: 'Invalid ID provided for Mason or Dealer' });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to update technical site',
        details: (error as Error)?.message ?? 'Unknown error',
      });
    }
  });

  console.log('✅ Technical Sites PATCH endpoint ready (M-N Support Only)');
}