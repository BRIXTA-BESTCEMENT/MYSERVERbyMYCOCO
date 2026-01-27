// server/src/routes/postRoutes/tvr.ts

import { Request, Response, Express } from 'express';
import { db } from '../../db/db';
import { technicalVisitReports } from '../../db/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// ---- helpers ----
const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

const toStringArray = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    return s.includes(',') ? s.split(',').map(t => t.trim()).filter(Boolean) : [s];
  }
  return [];
};

const nullableString = z
  .string()
  .transform((s) => (s.trim() === '' ? null : s))
  .optional()
  .nullable();

const nullableBoolean = z.boolean().optional().nullable();

const sanitize = (obj: any) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v ?? null])
  );

// --- Zod schema that EXACTLY matches the DB table ---
const tvrInputSchema = z
  .object({
    // --- Core & Contact ---
    userId: z.coerce.number().int().positive(),
    reportDate: z.coerce.date(),
    visitType: z.string().max(50),
    siteNameConcernedPerson: z.string().max(255),
    phoneNo: z.string().max(20),
    whatsappNo: nullableString,
    emailId: nullableString,
    siteAddress: nullableString,
    marketName: nullableString,
    visitCategory: nullableString,
    customerType: nullableString,
    purposeOfVisit: nullableString,
    siteVisitStage: nullableString,
    constAreaSqFt: z.coerce.number().int().nullable().optional(),
    siteVisitBrandInUse: z.preprocess(toStringArray, z.array(z.string()).min(1, "siteVisitBrandInUse requires at least one brand")),
    currentBrandPrice: z.coerce.number().nullable().optional(),
    siteStock: z.coerce.number().nullable().optional(),
    estRequirement: z.coerce.number().nullable().optional(),
    supplyingDealerName: nullableString,
    nearbyDealerName: nullableString,
    associatedPartyName: nullableString,
    channelPartnerVisit: nullableString,
    isConverted: nullableBoolean,
    conversionType: nullableString,
    conversionFromBrand: nullableString,
    conversionQuantityValue: z.coerce.number().nullable().optional(),
    conversionQuantityUnit: z
      .string()
      .optional()
      .nullable()
      .transform(v => (v == null || v.trim() === '' ? 'Bags' : v)),
    isTechService: nullableBoolean,
    serviceDesc: nullableString,
    serviceType: nullableString,
    dhalaiVerificationCode: nullableString,
    isVerificationStatus: nullableString,
    qualityComplaint: nullableString,
    influencerName: nullableString,
    influencerPhone: nullableString,
    isSchemeEnrolled: nullableBoolean,
    influencerProductivity: nullableString,
    influencerType: z
      .preprocess(toStringArray, z.array(z.string()))
      .transform(arr => arr.length === 0 ? ['Dealer'] : arr),
    clientsRemarks: z.string().max(500),
    salespersonRemarks: z.string().max(500),
    promotionalActivity: nullableString,
    checkInTime: z.coerce.date(),
    checkOutTime: z.coerce.date().nullable().optional(),
    timeSpentinLoc: nullableString,
    inTimeImageUrl: nullableString,
    outTimeImageUrl: nullableString,
    sitePhotoUrl: nullableString,
    siteVisitType: nullableString,
    meetingId: nullableString,
    pjpId: nullableString,
    masonId: nullableString,
    siteId: nullableString,
    journeyId: nullableString,
    firstVisitTime: z.coerce.date().nullable().optional(),
    lastVisitTime: z.coerce.date().nullable().optional(),
    firstVisitDay: nullableString,
    lastVisitDay: nullableString,
    siteVisitsCount: z.coerce.number().int().nullable().optional(),
    otherVisitsCount: z.coerce.number().int().nullable().optional(),
    totalVisitsCount: z.coerce.number().int().nullable().optional(),
    region: nullableString,
    area: nullableString,
    latitude: z.coerce.number().nullable().optional(),
    longitude: z.coerce.number().nullable().optional(),
  })
  .strict();

function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: typeof technicalVisitReports,
  tableName: string,
}) {
  const { endpoint, table, tableName } = config;

  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      // 1) validate + coerce
      const input = tvrInputSchema.parse(req.body);

      // 2) map to insert
      const insertData = {
        id: randomUUID(), // App-generated UUID
        userId: input.userId,
        reportDate: toDateOnly(input.reportDate), // Normalize to YYYY-MM-DD

        // --- Core Contact ---
        siteNameConcernedPerson: input.siteNameConcernedPerson,
        phoneNo: input.phoneNo,
        whatsappNo: input.whatsappNo ?? null,
        emailId: input.emailId ?? null,
        siteAddress: input.siteAddress ?? null,
        marketName: input.marketName ?? null,
        region: input.region ?? null,
        area: input.area ?? null,
        latitude: input.latitude != null ? String(input.latitude) : null,
        longitude: input.longitude != null ? String(input.longitude) : null,

        // --- Visit Info ---
        visitType: input.visitType,
        visitCategory: input.visitCategory ?? null,
        customerType: input.customerType ?? null,
        purposeOfVisit: input.purposeOfVisit ?? null,

        // --- Construction & Stock ---
        siteVisitStage: input.siteVisitStage ?? null,
        constAreaSqFt: input.constAreaSqFt ?? null,
        siteVisitBrandInUse: input.siteVisitBrandInUse,
        currentBrandPrice: input.currentBrandPrice != null ? String(input.currentBrandPrice) : null,
        siteStock: input.siteStock != null ? String(input.siteStock) : null,
        estRequirement: input.estRequirement != null ? String(input.estRequirement) : null,

        // --- Dealers ---
        supplyingDealerName: input.supplyingDealerName ?? null,
        nearbyDealerName: input.nearbyDealerName ?? null,
        associatedPartyName: input.associatedPartyName ?? null,
        channelPartnerVisit: input.channelPartnerVisit ?? null,

        // --- Conversion ---
        isConverted: input.isConverted ?? null,
        conversionType: input.conversionType ?? null,
        conversionFromBrand: input.conversionFromBrand ?? null,
        conversionQuantityValue: input.conversionQuantityValue != null ? String(input.conversionQuantityValue) : null,
        conversionQuantityUnit: input.conversionQuantityUnit ?? null,

        // --- Technical Services ---
        isTechService: input.isTechService ?? null,
        serviceDesc: input.serviceDesc ?? null,
        serviceType: input.serviceType ?? null,
        dhalaiVerificationCode: input.dhalaiVerificationCode ?? null,
        isVerificationStatus: input.isVerificationStatus ?? null,
        qualityComplaint: input.qualityComplaint ?? null,

        // --- Influencer / Mason ---
        influencerName: input.influencerName ?? null,
        influencerPhone: input.influencerPhone ?? null,
        isSchemeEnrolled: input.isSchemeEnrolled ?? null,
        influencerProductivity: input.influencerProductivity ?? null,
        influencerType: input.influencerType,

        // --- Remarks ---
        clientsRemarks: input.clientsRemarks,
        salespersonRemarks: input.salespersonRemarks,
        promotionalActivity: input.promotionalActivity ?? null,

        // --- Time & Images ---
        checkInTime: input.checkInTime, // Full timestamp
        checkOutTime: input.checkOutTime ?? null,
        inTimeImageUrl: input.inTimeImageUrl ?? null,
        outTimeImageUrl: input.outTimeImageUrl ?? null,
        timeSpentinLoc: input.timeSpentinLoc ?? null,
        sitePhotoUrl: input.sitePhotoUrl ?? null,

        // --- Meta / Legacy / Foreign Keys ---
        siteVisitType: input.siteVisitType ?? null,
        meetingId: input.meetingId ?? null,
        pjpId: input.pjpId ?? null,
        masonId: input.masonId ?? null,
        siteId: input.siteId ?? null,
        journeyId: input.journeyId ?? null,

        // --- Counters ---
        firstVisitTime: input.firstVisitTime ?? null,
        lastVisitTime: input.lastVisitTime ?? null,
        firstVisitDay: input.firstVisitDay ?? null,
        lastVisitDay: input.lastVisitDay ?? null,
        siteVisitsCount: input.siteVisitsCount ?? null,
        otherVisitsCount: input.otherVisitsCount ?? null,
        totalVisitsCount: input.totalVisitsCount ?? null,
      };

      // 3) insert + return
      const [record] = await db.insert(table).values(insertData).returning();

      return res.status(201).json({
        success: true,
        message: `${tableName} created successfully`,
        data: sanitize(record),
      });
    } catch (error) {
      console.error(`Create ${tableName} error:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
            code: i.code,
          })),
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

export default function setupTechnicalVisitReportsPostRoutes(app: Express) {
  createAutoCRUD(app, {
    endpoint: 'technical-visit-reports',
    table: technicalVisitReports,
    tableName: 'Technical Visit Report',
  });

  console.log('✅ Technical Visit Reports POST endpoints setup complete (Schema-Accurate)');
}