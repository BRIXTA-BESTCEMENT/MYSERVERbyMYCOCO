ALTER TABLE "logistics_gate_io" RENAME TO "logistics_io";--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "purpose" varchar(255);--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "type_of_materials" varchar(255);--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "vehicle_number" varchar(100);--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "store_date" date;--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "store_time" varchar(50);--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "no_of_invoice" integer;--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "party_name" varchar(255);--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "invoice_nos" text[];--> statement-breakpoint
ALTER TABLE "logistics_io" ADD COLUMN "bill_nos" text[];