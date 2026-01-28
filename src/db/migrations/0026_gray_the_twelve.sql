ALTER TABLE "tso_meetings" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tso_meetings" ALTER COLUMN "date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "zone" varchar(100);--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "market" varchar(100);--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "dealer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "dealer_address" varchar(500);--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "conducted_by" varchar(255);--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "gift_type" varchar(255);--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "account_jsb_jud" varchar(100);--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "total_expenses" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "tso_meetings" ADD COLUMN "bill_submitted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tso_meetings" DROP COLUMN "location";--> statement-breakpoint
ALTER TABLE "tso_meetings" DROP COLUMN "budget_allocated";