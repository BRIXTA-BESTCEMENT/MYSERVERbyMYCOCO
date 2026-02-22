ALTER TABLE "email_reports" ADD COLUMN "institution" text;--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "report_name" text;--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "dealer_names" jsonb;--> statement-breakpoint
ALTER TABLE "email_reports" ADD COLUMN "report_date" date;--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "meet_image_url" varchar(300);