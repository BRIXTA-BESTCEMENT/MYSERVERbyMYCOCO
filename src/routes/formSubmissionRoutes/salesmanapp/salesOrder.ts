// server/src/routes/postRoutes/salesmanapp/salesOrders.ts

import { Request, Response, Express } from 'express';
import { db } from '../../../db/db';
import { salesOrders, verifiedDealers } from '../../../db/schema'; 
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { InferInsertModel, eq, sql } from 'drizzle-orm';

type SalesOrderInsert = InferInsertModel<typeof salesOrders>;

// ---------- helpers ----------
const toYYYYMMDD = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const d = new Date(v);
    if (Number.isNaN(+d)) return v; 
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
};
const toDecimalString = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return String(v);
  return String(n);
};
const nullIfEmpty = (v: unknown): string | null =>
  v == null || (typeof v === 'string' && v.trim() === '') ? null : String(v);

// ---------- input schema ----------
const salesOrderInputSchema = z.object({
  // Removed orderID from here since we generate it completely on the backend now
  // ALTER SEQUENCE bestcement.sales_order_id_seq RESTART WITH 1; // to restart the seq
  userId: z.coerce.number().int().optional().nullable(),
  dealerId: z.string().max(255).optional().nullable().or(z.literal('')),
  verifiedDealerId: z.coerce.number().int().optional().nullable(),
  dvrId: z.string().max(255).optional().nullable().or(z.literal('')),
  pjpId: z.string().max(255).optional().nullable().or(z.literal('')),

  orderDate: z.union([z.string(), z.date()]),
  orderPartyName: z.string().min(1, 'orderPartyName is required'),
  partyPhoneNo: z.string().optional().nullable().or(z.literal('')),
  partyArea: z.string().optional().nullable().or(z.literal('')), // District
  partyRegion: z.string().optional().nullable().or(z.literal('')), // Zone
  partyAddress: z.string().optional().nullable().or(z.literal('')),
  deliveryDate: z.union([z.string(), z.date()]).optional().nullable(),
  deliveryArea: z.string().optional().nullable().or(z.literal('')),
  deliveryRegion: z.string().optional().nullable().or(z.literal('')),
  deliveryAddress: z.string().optional().nullable().or(z.literal('')),
  deliveryLocPincode: z.string().optional().nullable().or(z.literal('')),
  paymentMode: z.string().optional().nullable().or(z.literal('')),
  paymentTerms: z.string().optional().nullable().or(z.literal('')),
  paymentAmount: z.union([z.string(), z.number()]).optional().nullable(),
  receivedPayment: z.union([z.string(), z.number()]).optional().nullable(),
  receivedPaymentDate: z.union([z.string(), z.date()]).optional().nullable(),
  pendingPayment: z.union([z.string(), z.number()]).optional().nullable(),
  orderQty: z.union([z.string(), z.number()]).optional().nullable(),
  orderUnit: z.string().max(20).optional().nullable().or(z.literal('')),
  itemPrice: z.union([z.string(), z.number()]).optional().nullable(),
  discountPercentage: z.union([z.string(), z.number()]).optional().nullable(),
  itemPriceAfterDiscount: z.union([z.string(), z.number()]).optional().nullable(),
  itemType: z.string().max(20).optional().nullable().or(z.literal('')),
  itemGrade: z.string().max(10).optional().nullable().or(z.literal('')),
  status: z.string().max(50).optional().default('Pending'),
  salesCategory: z.string().max(20).optional(),
});

function createAutoCRUD(app: Express, config: {
  endpoint: string,
  table: typeof salesOrders,
  tableName: string,
}) {
  const { endpoint, table, tableName } = config;

  app.post(`/api/${endpoint}`, async (req: Request, res: Response) => {
    try {
      const input = salesOrderInputSchema.parse(req.body);

      // Normalize IDs
      const dealerId = input.dealerId === '' ? null : input.dealerId ?? null;
      const verifiedDealerId = input.verifiedDealerId ?? null;
      const dvrId = input.dvrId === '' ? null : input.dvrId ?? null;
      const pjpId = input.pjpId === '' ? null : input.pjpId ?? null;

      // ---------------------------------------------------------
      // 🏗️ BUILD SMART ORDER ID
      // ---------------------------------------------------------
      
      // 1. Get Pincode (Try DB first, fallback to form input, fallback to 000000)
      let finalPincode = input.deliveryLocPincode || '000000';
      if (verifiedDealerId) {
        const [dealerData] = await db
          .select({ pinCode: verifiedDealers.pinCode }) 
          .from(verifiedDealers)
          .where(eq(verifiedDealers.id, verifiedDealerId));
          
        if (dealerData?.pinCode) {
          finalPincode = dealerData.pinCode;
        }
      }

      // 2. Format Zone (e.g., "Central Assam" -> "CA")
      const zoneStr = (input.partyRegion || 'UNK')
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();

      // 3. Format District (First 5 letters, e.g., "Morigaon" -> "MORIG")
      const distStr = (input.partyArea || 'UNKN')
        .replace(/\s+/g, '') // remove spaces
        .substring(0, 5)
        .toUpperCase();

      // 4. Get Sequence Number from Postgres
      const { rows } = await db.execute(sql`SELECT nextval('bestcement.sales_order_id_seq')`);
      const seqNum = rows[0].nextval;

      // Assemble: JUD-CA-MORIG-782105-1
      const generatedOrderId = `JUD-${zoneStr}-${distStr}-${finalPincode}-${seqNum}`;

      // ---------------------------------------------------------

      // Dates
      const orderDate = toYYYYMMDD(input.orderDate);
      if (!orderDate) {
        return res.status(400).json({ success: false, error: 'orderDate is invalid' });
      }
      const deliveryDate = toYYYYMMDD(input.deliveryDate ?? null);
      const receivedPaymentDate = toYYYYMMDD(input.receivedPaymentDate ?? null);

      // Numerics
      const paymentAmountStr = toDecimalString(input.paymentAmount);
      const receivedPaymentStr = toDecimalString(input.receivedPayment);
      let pendingPaymentStr = toDecimalString(input.pendingPayment);
      const orderQtyStr = toDecimalString(input.orderQty);
      const itemPriceStr = toDecimalString(input.itemPrice);
      const discountPctStr = toDecimalString(input.discountPercentage);
      let itemPriceAfterDiscountStr = toDecimalString(input.itemPriceAfterDiscount);

      // Computed fields
      if (pendingPaymentStr == null && paymentAmountStr != null && receivedPaymentStr != null) {
        const pa = Number(paymentAmountStr);
        const rp = Number(receivedPaymentStr);
        if (Number.isFinite(pa) && Number.isFinite(rp)) {
          pendingPaymentStr = String(pa - rp);
        }
      }
      if (itemPriceAfterDiscountStr == null && itemPriceStr != null && discountPctStr != null) {
        const p = Number(itemPriceStr);
        const d = Number(discountPctStr);
        if (Number.isFinite(p) && Number.isFinite(d)) {
          itemPriceAfterDiscountStr = String(p * (1 - d / 100));
        }
      }

      const insertData: SalesOrderInsert = {
        id: randomUUID(),
        orderId: generatedOrderId, // Add the generated ID here
        userId: input.userId ?? null,
        dealerId,
        verifiedDealerId,
        dvrId,
        pjpId,
        orderDate,
        orderPartyName: input.orderPartyName,
        partyPhoneNo: nullIfEmpty(input.partyPhoneNo),
        partyArea: nullIfEmpty(input.partyArea),
        partyRegion: nullIfEmpty(input.partyRegion),
        partyAddress: nullIfEmpty(input.partyAddress),
        deliveryDate,
        deliveryArea: nullIfEmpty(input.deliveryArea),
        deliveryRegion: nullIfEmpty(input.deliveryRegion),
        deliveryAddress: nullIfEmpty(input.deliveryAddress),
        deliveryLocPincode: nullIfEmpty(input.deliveryLocPincode),
        paymentMode: nullIfEmpty(input.paymentMode),
        paymentTerms: nullIfEmpty(input.paymentTerms),
        paymentAmount: paymentAmountStr,
        receivedPayment: receivedPaymentStr,
        receivedPaymentDate,
        pendingPayment: pendingPaymentStr,
        orderQty: orderQtyStr,
        orderUnit: nullIfEmpty(input.orderUnit),
        itemPrice: itemPriceStr,
        discountPercentage: discountPctStr,
        itemPriceAfterDiscount: itemPriceAfterDiscountStr,
        itemType: nullIfEmpty(input.itemType),
        itemGrade: nullIfEmpty(input.itemGrade),
        status: input.status, 
        salesCategory: input.salesCategory ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

export default function setupSalesOrdersPostRoutes(app: Express) {
  createAutoCRUD(app, {
    endpoint: 'sales-orders',
    table: salesOrders,
    tableName: 'Sales Order',
  });
  console.log('✅ Sales Orders POST endpoint ready');
}