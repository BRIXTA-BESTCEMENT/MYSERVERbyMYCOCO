ALTER TABLE "reward_redemptions" RENAME COLUMN "fulfillmentNotes" TO "fulfillment_notes";--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ALTER COLUMN "status" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "route" varchar(500);--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "planned_new_site_visits" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "planned_follow_up_site_visits" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "planned_new_dealer_visits" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "planned_influencer_visits" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "influencer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "influencer_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "activity_type" varchar(255);--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "noof_converted_bags" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "noof_masonpc_in_schemes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" ADD COLUMN "diversion_reason" varchar(500);