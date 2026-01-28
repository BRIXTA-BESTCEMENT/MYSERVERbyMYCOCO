// src/routes/formSubmissionRoutes/masonpcSide.ts
import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { masonPcSide } from '../../db/schema'; 
import { z } from 'zod';
import { InferInsertModel, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// -------- Helpers --------

export const strOrNull = z.preprocess((val) => {
  if (val === '') return null;
  if (typeof val === 'string') {
    const t = val.trim();
    return t === '' ? null : t;
  }
  return val;
}, z.string().nullable().optional());

export const intOrNull = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}, z.number().int().nullable().optional());

// -------- Input Schema --------

const insertMasonPcSideSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  kycDocumentName: strOrNull,
  kycDocumentIdNum: strOrNull,
  kycStatus: strOrNull,
  bagsLifted: intOrNull,
  isReferred: z.boolean().nullable().optional(),
  referredByUser: strOrNull,
  referredToUser: strOrNull,
  dealerId: strOrNull,
  userId: intOrNull,
  deviceId: strOrNull,
  fcmToken: strOrNull,
}).strict();

type NewMason = InferInsertModel<typeof masonPcSide>;

export default function setupMasonPcSidePostRoutes(app: Express) {

  app.post('/api/masons', async (req: Request, res: Response) => {
    const tableName = 'Mason';

    try {
      const validated = insertMasonPcSideSchema.parse(req.body);
      
      // 1. Insert Mason with 0 balance
      // Points will be handled by the KYC Submission route (on-spot approval)
      const [newRecord] = await db
        .insert(masonPcSide)
        .values({
          id: randomUUID(),
          name: validated.name,
          phoneNumber: validated.phoneNumber,
          kycDocumentName: validated.kycDocumentName ?? null,
          kycDocumentIdNum: validated.kycDocumentIdNum ?? null,
          kycStatus: validated.kycStatus ?? 'pending',
          bagsLifted: validated.bagsLifted ?? 0,
          pointsBalance: 0, // <--- Always start at 0
          isReferred: validated.isReferred ?? null,
          referredByUser: validated.referredByUser ?? null,
          referredToUser: validated.referredToUser ?? null,
          dealerId: validated.dealerId ?? null,
          userId: validated.userId ?? null,
          deviceId: validated.deviceId ?? null,
          fcmToken: validated.fcmToken ?? null,
        })
        .returning();

      if (!newRecord) {
        throw new Error('Failed to create new mason record.');
      }

      // 2. Send success response
      return res.status(201).json({
        success: true,
        message: `${tableName} created successfully. Points will be credited upon KYC approval.`,
        data: newRecord,
      });

    } catch (err: any) {
      console.error(`Create ${tableName} error:`, err);

      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        });
      }

      // Handle Unique/Foreign Key Violations
      if (err?.code === '23505') {
        return res.status(409).json({
          success: false,
          error: "Conflict: This phone number or device is already registered.",
        });
      }

      return res.status(500).json({
        success: false,
        error: `Failed to create ${tableName}`,
        details: err?.message ?? 'Unknown error'
      });
    }
  });
}