CREATE TABLE "outstanding_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"security_deposit_amt" numeric(14, 2),
	"pending_amt" numeric(14, 2),
	"less_than_10_days" numeric(14, 2),
	"10_to_15_days" numeric(14, 2),
	"15_to_21_days" numeric(14, 2),
	"21_to_30_days" numeric(14, 2),
	"30_to_45_days" numeric(14, 2),
	"45_to_60_days" numeric(14, 2),
	"60_to_75_days" numeric(14, 2),
	"75_to_90_days" numeric(14, 2),
	"greater_than_90_days" numeric(14, 2),
	"is_overdue" boolean DEFAULT false,
	"is_account_jsb_jud" boolean DEFAULT false,
	"verified_dealer_id" integer,
	"collection_report_id" uuid,
	"dvr_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution" varchar(10),
	"report_date" date NOT NULL,
	"zone" varchar(100) NOT NULL,
	"order_dealer_name" varchar(255),
	"order_qty_mt" numeric(10, 2),
	"collection_dealer_name" varchar(255),
	"collection_amount" numeric(14, 2),
	"dealer_id" varchar(255),
	"sales_promoter_user_id" integer,
	"source_message_id" text,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projection_vs_actual_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"institution" varchar(10),
	"zone" varchar(120) NOT NULL,
	"dealer_name" varchar(255) NOT NULL,
	"order_projection_mt" numeric(12, 2),
	"actual_order_received_mt" numeric(12, 2),
	"do_done_mt" numeric(12, 2),
	"projection_vs_actual_order_mt" numeric(12, 2),
	"actual_order_vs_do_mt" numeric(12, 2),
	"collection_projection" numeric(14, 2),
	"actual_collection" numeric(14, 2),
	"short_fall" numeric(14, 2),
	"percent" numeric(6, 2),
	"source_message_id" text,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verified_dealers" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealer_code" varchar(255),
	"dealer_category" varchar(255),
	"is_subdealer" boolean,
	"dealer_party_name" varchar(255),
	"zone" varchar(255),
	"area" varchar(255),
	"contact_no1" varchar(20),
	"contact_no2" varchar(20),
	"email" varchar(255),
	"address" text,
	"pin_code" varchar(20),
	"related_sp_name" varchar(255),
	"owner_proprietor_name" varchar(255),
	"nature_of_firm" varchar(255),
	"gst_no" varchar(50),
	"pan_no" varchar(50),
	"user_id" integer,
	"dealer_id" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "collection_reports" ALTER COLUMN "institution" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dealer_brand_mapping" ADD COLUMN "verified_dealer_id" integer;--> statement-breakpoint
ALTER TABLE "outstanding_reports" ADD CONSTRAINT "outstanding_reports_verified_dealer_id_verified_dealers_id_fk" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outstanding_reports" ADD CONSTRAINT "outstanding_reports_collection_report_id_collection_reports_id_fk" FOREIGN KEY ("collection_report_id") REFERENCES "public"."collection_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outstanding_reports" ADD CONSTRAINT "outstanding_reports_dvr_id_daily_visit_reports_id_fk" FOREIGN KEY ("dvr_id") REFERENCES "public"."daily_visit_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_reports" ADD CONSTRAINT "projection_reports_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD CONSTRAINT "verified_dealers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_dealers" ADD CONSTRAINT "verified_dealers_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_outstanding_verified_dealer" ON "outstanding_reports" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_outstanding_collection_report" ON "outstanding_reports" USING btree ("collection_report_id");--> statement-breakpoint
CREATE INDEX "idx_outstanding_dvr" ON "outstanding_reports" USING btree ("dvr_id");--> statement-breakpoint
CREATE INDEX "idx_projection_date" ON "projection_reports" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "idx_projection_zone" ON "projection_reports" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_projection_institution" ON "projection_reports" USING btree ("institution");--> statement-breakpoint
CREATE INDEX "idx_projection_dealer" ON "projection_reports" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_date" ON "projection_vs_actual_reports" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_zone" ON "projection_vs_actual_reports" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_dealer" ON "projection_vs_actual_reports" USING btree ("dealer_name");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_institution" ON "projection_vs_actual_reports" USING btree ("institution");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_proj_actual_snapshot" ON "projection_vs_actual_reports" USING btree ("report_date","dealer_name","institution");--> statement-breakpoint
ALTER TABLE "dealer_brand_mapping" ADD CONSTRAINT "dealer_brand_mapping_verified_dealer_id_verified_dealers_id_fk" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;