// server/src/routes/postRoutes/technicalSites.ts

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { technicalSites, insertTechnicalSiteSchema } from '../../db/schema'; 
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { InferInsertModel } from 'drizzle-orm';

// Define the required insert type for better safety
type TechnicalSiteInsert = InferInsertModel<typeof technicalSites>;

// --- Helper for simplified Auto CRUD POST operations ---
function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: typeof technicalSites,
  schema: z.ZodSchema<any>,
  tableName: string,
}) {
  const { endpoint, table, schema, tableName } = config;

  // CREATE NEW RECORD
  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      // 1. Validate the payload against the schema
      const parsed = schema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed for Technical Site submission.', 
          details: parsed.error.errors 
        });
      }

      const validatedData = parsed.data;

      // 2. Generate a UUID for the primary key
      const generatedId = randomUUID();
      
      // 3. Prepare data for insertion
      const insertData: TechnicalSiteInsert = {
        ...validatedData,
        id: generatedId,
        constructionStartDate: validatedData.constructionStartDate ? new Date(validatedData.constructionStartDate) : null,
        constructionEndDate: validatedData.constructionEndDate ? new Date(validatedData.constructionEndDate) : null,
        firstVistDate: validatedData.firstVistDate ? new Date(validatedData.firstVistDate) : null,
        lastVisitDate: validatedData.lastVisitDate ? new Date(validatedData.lastVisitDate) : null,
        imageUrl: validatedData.imageUrl ?? null,
      };

      // 4. Insert the record
      const [newRecord] = await db.insert(table).values(insertData as any).returning();

      res.status(201).json({
        success: true,
        message: `${tableName} created successfully with ID ${newRecord.id}`,
        data: newRecord
      });
    } catch (error: any) {
      console.error(`Create ${tableName} error:`, error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
      }
      
      const msg = String(error?.message ?? '').toLowerCase();
      if (error?.code === '23503' || msg.includes('violates foreign key constraint')) {
        return res.status(400).json({ success: false, error: 'Foreign Key violation: Related Dealer/Mason/PC ID does not exist.' });
      }

      res.status(500).json({ success: false, error: `Failed to create ${tableName}`, details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
}

export default function setupTechnicalSitesPostRoutes(app: Express) {
  
  // 🔥 THE FIX IS HERE 🔥
  // We create a "patched" schema that overrides strict string checks.
  // z.coerce.string() will take the Number from Flutter and turn it into a String automatically.
  const patchedSchema = insertTechnicalSiteSchema.extend({
    latitude: z.coerce.string(), 
    longitude: z.coerce.string(),
  });

  createAutoCRUD(app, {
    endpoint: 'technical-sites',
    table: technicalSites,
    schema: patchedSchema, // <--- Use the patched schema here
    tableName: 'Technical Site',
  });
  
  console.log('✅ Technical Sites POST endpoint setup complete');
}