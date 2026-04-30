CREATE TABLE "bestcement"."finance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"source_file_name" text,
	"source_message_id" text,
	"raw_payload" jsonb NOT NULL,
	"detected_months" jsonb,
	"plbs_status" jsonb,
	"cost_sheet_jsb" jsonb,
	"cost_sheet_jud" jsonb,
	"investor_queries" jsonb,
	"parser_warnings" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bestcement"."logistics_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"source_file_name" text,
	"source_message_id" text,
	"raw_payload" jsonb NOT NULL,
	"cement_dispatch_data" jsonb,
	"raw_material_stock_data" jsonb,
	"transporter_payment_data" jsonb,
	"parser_warnings" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bestcement"."sales_orders" ADD COLUMN "order_id" varchar(100);