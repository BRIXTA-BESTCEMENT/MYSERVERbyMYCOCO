// src/routes/formSubmissionRoutes/bagsLift.ts

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { bagLifts, insertBagLiftSchema, masonPcSide } from '../../db/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { InferInsertModel } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

//notification
import { sendNotification } from '../../services/notifications';

// --- IMPORT CORE CALCULATION LOGIC ---
import { calculateBaseAndBonanzaPoints } from '../../utils/pointsCalcLogic';
// --- END IMPORT ---

// Define the core BagLift type for use in the insert, excluding the memo that's not in the table
type BagLiftInsert = InferInsertModel<typeof bagLifts>;

const bagLiftSubmissionSchema = insertBagLiftSchema.omit({
    id: true,
    status: true,
    approvedBy: true,
    approvedAt: true,
    createdAt: true,
    pointsCredited: true,
    imageUrl: true,
    siteId: true,
    siteKeyPersonName: true,
    siteKeyPersonPhone: true,
    verificationSiteImageUrl: true,
    verificationProofImageUrl: true,
}).extend({
    masonId: z.string().uuid({ message: 'A valid Mason ID (UUID) is required.' }),
    purchaseDate: z.string().transform(str => new Date(str)),
    bagCount: z.number().int().positive('Bag count must be a positive integer.'),
    memo: z.string().max(500).optional(), // Note: Not inserted, but validated
    imageUrl: z.string().url({ message: "Invalid image URL" }).optional(),
});

/**
 * Sets up the POST route for the bag_lifts table.
 * * POST /api/bag-lifts
 * - Creates a new bag_lift record with status 'pending'.
 * - Calculates pointsCredited on the server using imported logic.
 */
export default function setupBagLiftsPostRoute(app: Express) {

    app.post('/api/bag-lifts', async (req: Request, res: Response) => {
        try {
            // 1. Validate incoming data
            const validationResult = bagLiftSubmissionSchema.safeParse(req.body);

            if (!validationResult.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed for Bag Lift submission.',
                    details: validationResult.error.errors
                });
            }

            const validatedData = validationResult.data;
            const { masonId, bagCount, purchaseDate, imageUrl, ...bagLiftBody } = validatedData;

            // --- 2. SERVER-SIDE POINT CALCULATION (SECURITY FIX) ---
            // Now uses the imported, centralized logic
            const calculatedPoints = calculateBaseAndBonanzaPoints(bagCount, purchaseDate);
            // --- END CALCULATION ---

            const generatedBagLiftId = randomUUID();

            // 3. Prepare Insert Data
            const insertData: BagLiftInsert = {
                ...(bagLiftBody as any),
                id: generatedBagLiftId,
                masonId: masonId,
                bagCount: bagCount,
                purchaseDate: purchaseDate,
                imageUrl: imageUrl,
                pointsCredited: calculatedPoints, // <<<--- Calculated on server via imported function
                status: 'pending',
                approvedBy: null,
                approvedAt: null,
            };

            // 4. Insert the Bag Lift record
            const [newBagLift] = await db.insert(bagLifts)
                .values(insertData)
                .returning();

            if (!newBagLift) {
                throw new Error('Failed to insert new bag lift record.');
            }
            //6. Notification part yaat ase:
            const [masonRecord] = await db
                .select({ tsoId: masonPcSide.userId })
                .from(masonPcSide)
                .where(eq(masonPcSide.id, masonId))
                .limit(1);
            if (masonRecord && masonRecord.tsoId) {
                console.log(`🔔 Found TSO (User ID: ${masonRecord.tsoId}) for Mason ${masonId}. Sending alert...`);

                await sendNotification(
                    masonRecord.tsoId, // Ensure it's a string for the notification service
                    "BAG LIFTED, Approve now!",
                    `Mason has submitted ${bagCount} bags. Tap to review.`,
                    "BAG_LIFT",
                    newBagLift.id
                );
            } else {
                console.log(`⚠️ No TSO assigned (userId is null) for Mason ${masonId}. No notifications sent.`);
            }

            // 5. Send success response
            res.status(201).json({
                success: true,
                message: `Bag Lift successfully submitted for TSO approval. Calculated points: ${newBagLift.pointsCredited}.`,
                data: newBagLift,
            });

        } catch (error: any) {
            console.error(`POST Bag Lift error:`, error);

            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message,
                        code: err.code
                    }))
                });
            }

            res.status(500).json({
                success: false,
                error: `Failed to create bag lift entry.`,
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    console.log('✅ Bag Lifts POST endpoint setup complete (Now defaults to PENDING status and calculates points securely using centralized logic)');
}