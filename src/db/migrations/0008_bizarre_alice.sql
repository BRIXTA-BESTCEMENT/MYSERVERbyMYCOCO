ALTER TABLE "technical_visit_reports" ADD COLUMN "market_name" varchar(100);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "site_address" varchar(500);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "whatsapp_no" varchar(20);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "visit_category" varchar(50);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "customer_type" varchar(50);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "const_area_sq_ft" integer;--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "current_brand_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "site_stock" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "est_requirement" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "supplying_dealer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "nearby_dealer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "is_converted" boolean;--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "conversion_type" varchar(50);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "is_tech_service" boolean;--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "service_desc" varchar(500);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "influencer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "influencer_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "is_scheme_enrolled" boolean;--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "influencer_productivity" varchar(100);