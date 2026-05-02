CREATE TABLE "bestcement"."accounts_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"source_file_name" text,
	"source_message_id" text,
	"raw_payload" jsonb NOT NULL,
	"accounts_dashboard_data" jsonb,
	"parser_warnings" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bestcement"."process_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"source_file_name" text,
	"source_message_id" text,
	"raw_payload" jsonb NOT NULL,
	"daily_status_reports" jsonb,
	"closing_stock" jsonb,
	"coal_consumption" jsonb,
	"target_achievement" jsonb,
	"parser_warnings" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bestcement"."purchase_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"source_file_name" text,
	"source_message_id" text,
	"raw_payload" jsonb NOT NULL,
	"daily_materials" jsonb,
	"monthly_important_materials" jsonb,
	"report_status" jsonb,
	"parser_warnings" jsonb,
	"created_at" timestamp DEFAULT now()
);
