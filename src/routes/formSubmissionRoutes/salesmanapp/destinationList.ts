// server/src/routes/formSubmissionRoutes/salesmanapp/destinationList.ts
import { Request, Response, Express } from 'express';
import { db } from '../../../db/db';
import { destinationMaster } from '../../../db/schema';
import { z } from 'zod';
import { InferInsertModel } from 'drizzle-orm';

type DestinationInsert = InferInsertModel<typeof destinationMaster>;

// ---------- helpers ----------
const nullIfEmpty = (v: unknown): string | null =>
  v == null || (typeof v === 'string' && v.trim() === '') ? null : String(v);

// ---------- input schema ----------
const destinationInputSchema = z.object({
  institution: z.string().max(20).optional().nullable().or(z.literal('')),
  zone: z.string().max(100).optional().nullable().or(z.literal('')),
  district: z.string().max(200).optional().nullable().or(z.literal('')),
  destination: z.string().max(200).optional().nullable().or(z.literal('')),
});

function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: typeof destinationMaster,
  tableName: string,
}) {
  const { endpoint, table, tableName } = config;

  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const input = destinationInputSchema.parse(req.body);

      // Note: `id` is omitted because it is a SERIAL column in PostgreSQL
      const insertData: DestinationInsert = {
        institution: nullIfEmpty(input.institution),
        zone: nullIfEmpty(input.zone),
        district: nullIfEmpty(input.district),
        destination: nullIfEmpty(input.destination),
      };

      const [row] = await db.insert(table).values(insertData).returning();

      return res.status(201).json({
        success: true,
        message: `${tableName} created successfully`,
        data: row,
      });
    } catch (error) {
      console.error(`Create ${tableName} error:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.issues?.map(i => ({
            field: i.path.join('.'),
            message: i.message,
            code: i.code,
          })) ?? [],
        });
      }
      return res.status(500).json({
        success: false,
        error: `Failed to create ${tableName}`,
        details: (error as Error)?.message ?? 'Unknown error',
      });
    }
  });
}

export default function setupDestinationPostRoutes(app: Express) {
  createAutoCRUD(app, {
    endpoint: 'destinations',
    table: destinationMaster,
    tableName: 'Destination',
  });
  console.log('✅ Destinations POST endpoint ready');
}