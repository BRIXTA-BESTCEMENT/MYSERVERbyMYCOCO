CREATE TABLE "bestcement"."sales_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"source_file_name" text,
	"source_message_id" text,
	"raw_payload" jsonb NOT NULL,
	"sales_data_payload" jsonb,
	"collection_data_payload" jsonb,
	"non_trade_data_payload" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bestcement"."collection_reports" ADD COLUMN "dealer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ADD COLUMN "dealer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."projection_reports" ADD COLUMN "dealer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."projection_vs_actual_reports" ADD COLUMN "dealer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_orders" ADD COLUMN "verified_dealer_id" integer;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_orders" ADD COLUMN "sales_category" varchar(20);