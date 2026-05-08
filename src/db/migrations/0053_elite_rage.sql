CREATE TABLE "bestcement"."it_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"item" varchar(255),
	"purchase_date" date,
	"make_model" text,
	"serial_no" text,
	"specification" text,
	"stock_status" varchar(100),
	"assigned_to" text,
	"department" varchar(255),
	"designation" text,
	"place" varchar(255),
	"assigned_date" date,
	"handover_date" date,
	"status" varchar(100),
	"remarks" text,
	"code" varchar(255),
	"accessories" text,
	"new_user" text,
	"reassigned_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "area" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "dealer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "responsible_person" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "current_month_mtd_sales" integer;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "current_month_target" integer;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "percentage_target_achieved" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "balance" integer;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "prorata_sales_target" integer;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "percentage_as_per_prorata" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "asking_rate" numeric(10, 2);--> statement-breakpoint
CREATE INDEX "idx_it_assets_item" ON "bestcement"."it_assets" USING btree ("item");--> statement-breakpoint
CREATE INDEX "idx_it_assets_serial_no" ON "bestcement"."it_assets" USING btree ("serial_no");--> statement-breakpoint
CREATE INDEX "idx_it_assets_assigned_to" ON "bestcement"."it_assets" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_it_assets_status" ON "bestcement"."it_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_it_assets_purchase_date" ON "bestcement"."it_assets" USING btree ("purchase_date");