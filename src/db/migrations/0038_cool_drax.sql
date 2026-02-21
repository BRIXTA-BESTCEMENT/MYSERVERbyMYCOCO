DROP INDEX "uniq_projection_snapshot";--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "institution" text;--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "report_name" text;--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "dealer_names" jsonb;--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "report_date" date;--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "gate_out_no_of_invoice" integer;--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "gate_out_invoice_nos" text[];--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "gate_out_bill_nos" text[];--> statement-breakpoint
ALTER TABLE "outstanding_reports" ADD COLUMN "temp_dealer_name" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_projection_snapshot" ON "projection_reports" USING btree ("report_date","order_dealer_name","collection_dealer_name","institution","zone");