ALTER TABLE "bestcement"."outstanding_reports" DROP CONSTRAINT "unique_outstanding_entry";--> statement-breakpoint
DROP INDEX "bestcement"."idx_outstanding_dvr";--> statement-breakpoint
DROP INDEX "bestcement"."idx_outstanding_email_report";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ALTER COLUMN "institution" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ALTER COLUMN "institution" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ADD COLUMN "dealer_name" text;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ADD COLUMN "ageing_data" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ADD COLUMN "is_due" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "idx_outstanding_report_date" ON "bestcement"."outstanding_reports" USING btree ("report_date");--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "less_than_10_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "10_to_15_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "15_to_21_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "21_to_30_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "30_to_45_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "45_to_60_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "60_to_75_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "75_to_90_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "greater_than_90_days";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "is_account_jsb_jud";--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" DROP COLUMN "temp_dealer_name";