ALTER TABLE "daily_visit_reports" ALTER COLUMN "report_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "dealer_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "location" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "latitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "longitude" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "visit_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "dealer_total_potential" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "dealer_best_potential" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "brand_selling" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "today_order_mt" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "today_collection_rupees" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "feedbacks" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ALTER COLUMN "check_in_time" DROP NOT NULL;