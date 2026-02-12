CREATE TABLE "collection_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution" varchar(10) NOT NULL,
	"voucher_no" varchar(100) NOT NULL,
	"voucher_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"bank_account" varchar(255),
	"remarks" varchar(500),
	"party_name" varchar(255) NOT NULL,
	"sales_promoter_name" varchar(255),
	"zone" varchar(100),
	"district" varchar(100),
	"dealer_id" varchar(255),
	"sales_promoter_user_id" integer,
	"source_message_id" text,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"subject" text,
	"sender" text,
	"file_name" text,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "dealer_name" varchar(255);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "dealer_category" varchar(50);--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD COLUMN "pjp_cycle" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin_app_user" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_app_login_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_app_hashed_password" text;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_sales_promoter_user_id_users_id_fk" FOREIGN KEY ("sales_promoter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_collection_institution" ON "collection_reports" USING btree ("institution");--> statement-breakpoint
CREATE INDEX "idx_collection_date" ON "collection_reports" USING btree ("voucher_date");--> statement-breakpoint
CREATE INDEX "idx_collection_dealer" ON "collection_reports" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_collection_user" ON "collection_reports" USING btree ("sales_promoter_user_id");--> statement-breakpoint
CREATE INDEX "idx_collection_voucher" ON "collection_reports" USING btree ("voucher_no");--> statement-breakpoint
CREATE INDEX "idx_email_reports_message" ON "email_reports" USING btree ("message_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_app_login_id_unique" UNIQUE("admin_app_login_id");