CREATE SCHEMA "bestcement";
--> statement-breakpoint
CREATE TABLE "bestcement"."bag_lifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"dealer_id" varchar(255),
	"purchase_date" timestamp with time zone NOT NULL,
	"bag_count" integer NOT NULL,
	"points_credited" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"image_url" text,
	"site_id" uuid,
	"site_key_person_name" varchar(255),
	"site_key_person_phone" varchar(20),
	"verification_site_image_url" text,
	"verification_proof_image_url" text
);
--> statement-breakpoint
CREATE TABLE "bestcement"."brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."collection_reports" (
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
	"sales_promoter_user_id" integer,
	"source_message_id" text,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_dealer_id" integer,
	"user_id" integer,
	"email_report_id" uuid
);
--> statement-breakpoint
CREATE TABLE "bestcement"."companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"office_address" text NOT NULL,
	"is_head_office" boolean DEFAULT true NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"admin_user_id" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"workos_organization_id" text,
	"area" text,
	"region" text
);
--> statement-breakpoint
CREATE TABLE "bestcement"."competition_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"brand_name" varchar(255) NOT NULL,
	"billing" varchar(100) NOT NULL,
	"nod" varchar(100) NOT NULL,
	"retail" varchar(100) NOT NULL,
	"schemes_yes_no" varchar(10) NOT NULL,
	"avg_scheme_cost" numeric(10, 2) NOT NULL,
	"remarks" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."daily_tasks" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pjp_batch_id" uuid,
	"user_id" integer NOT NULL,
	"dealer_id" varchar(255),
	"dealer_name_snapshot" varchar(255),
	"dealer_mobile" varchar(20),
	"zone" varchar(120),
	"area" varchar(120),
	"route" text,
	"objective" varchar(255),
	"visit_type" varchar(100),
	"required_visit_count" integer,
	"week" varchar(50),
	"task_date" date NOT NULL,
	"status" varchar(50) DEFAULT 'Assigned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."daily_visit_reports" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"dealer_id" varchar(255),
	"sub_dealer_id" varchar(255),
	"report_date" date,
	"dealer_type" varchar(50),
	"location" varchar(500),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"visit_type" varchar(50),
	"dealer_total_potential" numeric(10, 2),
	"dealer_best_potential" numeric(10, 2),
	"brand_selling" text[],
	"contact_person" varchar(255),
	"contact_person_phone_no" varchar(20),
	"today_order_mt" numeric(10, 2),
	"today_collection_rupees" numeric(10, 2),
	"overdue_amount" numeric(12, 2),
	"feedbacks" varchar(500),
	"solution_by_salesperson" varchar(500),
	"any_remarks" varchar(500),
	"check_in_time" timestamp (6) with time zone,
	"check_out_time" timestamp (6) with time zone,
	"time_spent_in_loc" varchar(255),
	"in_time_image_url" varchar(500),
	"out_time_image_url" varchar(500),
	"pjp_id" varchar(255),
	"daily_task_id" varchar(255),
	"customer_type" varchar(100),
	"party_type" varchar(100),
	"name_of_party" varchar(255),
	"contact_no_of_party" varchar(20),
	"expected_activation_date" date,
	"current_dealer_outstanding_amt" numeric(14, 2),
	"idempotency_key" varchar(255),
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."_DealerAssociatedMasons" (
	"A" varchar(255) NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."dealer_brand_mapping" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"brand_id" integer NOT NULL,
	"capacity_mt" numeric(12, 2) NOT NULL,
	"user_id" integer,
	"best_capacity_mt" numeric(12, 2),
	"brand_growth_capacity_percent" numeric(5, 2),
	"verified_dealer_id" integer
);
--> statement-breakpoint
CREATE TABLE "bestcement"."dealer_reports_and_scores" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"dealer_score" numeric(10, 2) NOT NULL,
	"trust_worthiness_score" numeric(10, 2) NOT NULL,
	"credit_worthiness_score" numeric(10, 2) NOT NULL,
	"order_history_score" numeric(10, 2) NOT NULL,
	"visit_frequency_score" numeric(10, 2) NOT NULL,
	"last_updated_date" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."dealers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(50) NOT NULL,
	"parent_dealer_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"region" varchar(100) NOT NULL,
	"area" varchar(255) NOT NULL,
	"phone_no" varchar(20) NOT NULL,
	"address" varchar(500) NOT NULL,
	"total_potential" numeric(10, 2) NOT NULL,
	"best_potential" numeric(10, 2) NOT NULL,
	"brand_selling" text[],
	"feedbacks" varchar(500) NOT NULL,
	"remarks" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"pinCode" varchar(20),
	"dateOfBirth" date,
	"anniversaryDate" date,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"verification_status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"whatsapp_no" varchar(20),
	"email_id" varchar(255),
	"business_type" varchar(100),
	"gstin_no" varchar(20),
	"pan_no" varchar(20),
	"trade_lic_no" varchar(150),
	"aadhar_no" varchar(20),
	"godown_size_sqft" integer,
	"godown_capacity_mt_bags" varchar(500),
	"godown_address_line" varchar(500),
	"godown_landmark" varchar(255),
	"godown_district" varchar(100),
	"godown_area" varchar(255),
	"godown_region" varchar(100),
	"godown_pincode" varchar(20),
	"residential_address_line" varchar(500),
	"residential_landmark" varchar(255),
	"residential_district" varchar(100),
	"residential_area" varchar(255),
	"residential_region" varchar(100),
	"residential_pincode" varchar(20),
	"bank_account_name" varchar(255),
	"bank_name" varchar(255),
	"bank_branch_address" varchar(500),
	"bank_account_number" varchar(50),
	"bank_ifsc_code" varchar(50),
	"brand_name" varchar(255),
	"monthly_sale_mt" numeric(10, 2),
	"no_of_dealers" integer,
	"area_covered" varchar(255),
	"projected_monthly_sales_best_cement_mt" numeric(10, 2),
	"no_of_employees_in_sales" integer,
	"declaration_name" varchar(255),
	"declaration_place" varchar(100),
	"declaration_date" date,
	"trade_licence_pic_url" varchar(500),
	"shop_pic_url" varchar(500),
	"dealer_pic_url" varchar(500),
	"blank_cheque_pic_url" varchar(500),
	"partnership_deed_pic_url" varchar(500),
	"dealerdevelopmentstatus" varchar(50),
	"dealerdevelopmentobstacle" varchar(500),
	"sales_growth_percentage" numeric(5, 2),
	"no_of_pjp" integer,
	"nameOfFirm" varchar(500),
	"underSalesPromoterName" varchar(200),
	CONSTRAINT "dealers_gstin_no_unique" UNIQUE("gstin_no")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."email_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"subject" text,
	"sender" text,
	"file_name" text,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"is_success" boolean,
	"error_message" text,
	"fingerprint" text,
	"hash" text,
	"payload_hash" text,
	"schema_version" integer,
	"report_type" text,
	"cycle_date" date,
	"version" integer,
	"is_latest_version" boolean,
	"sheet_count" integer,
	"numeric_ratio" numeric,
	"has_ageing_pattern" boolean,
	"has_date_pattern" boolean,
	"processing_stage" text,
	"institution" text,
	"report_name" text,
	"dealer_names" jsonb,
	"report_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."geo_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"recorded_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"accuracy" numeric(10, 2),
	"speed" numeric(10, 2),
	"heading" numeric(10, 2),
	"altitude" numeric(10, 2),
	"location_type" varchar(50),
	"activity_type" varchar(50),
	"app_state" varchar(50),
	"battery_level" numeric(5, 2),
	"is_charging" boolean,
	"network_status" varchar(50),
	"ip_address" varchar(45),
	"site_name" varchar(255),
	"check_in_time" timestamp(6) with time zone,
	"check_out_time" timestamp(6) with time zone,
	"total_distance_travelled" numeric(10, 3),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	"dest_lat" numeric(10, 7),
	"dest_lng" numeric(10, 7),
	"is_active" boolean DEFAULT true NOT NULL,
	"journey_id" text,
	"site_id" uuid,
	"dealer_id" varchar(255),
	"linked_journey_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "bestcement"."gift_allocation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"source_user_id" integer,
	"destination_user_id" integer,
	"related_report_id" varchar(255),
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"reward_id" integer
);
--> statement-breakpoint
CREATE TABLE "bestcement"."hr_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"source_file_name" text,
	"source_message_id" text,
	"raw_payload" jsonb NOT NULL,
	"vacancies" jsonb,
	"statutory_clearances" jsonb,
	"top_performers" jsonb,
	"bottom_performers" jsonb,
	"interviews" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bestcement"."journey_breadcrumbs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"h3_index" varchar(15),
	"speed" real,
	"accuracy" real,
	"heading" real,
	"altitude" real,
	"battery_level" real,
	"is_charging" boolean,
	"network_status" varchar(50),
	"is_mocked" boolean DEFAULT false,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"is_synced" boolean DEFAULT false,
	"total_distance" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."journey_ops" (
	"server_seq" bigserial PRIMARY KEY NOT NULL,
	"op_id" uuid NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"app_role" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_ops_op_id_key" UNIQUE("op_id")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."journeys" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pjp_id" varchar(255),
	"site_id" varchar(255),
	"dealer_id" varchar(255),
	"site_name" varchar(255),
	"dest_lat" numeric(10, 7),
	"dest_lng" numeric(10, 7),
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"is_active" boolean DEFAULT true,
	"start_time" timestamp with time zone DEFAULT now() NOT NULL,
	"end_time" timestamp with time zone,
	"total_distance" numeric(10, 3) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_synced" boolean DEFAULT false,
	"task_id" varchar(255),
	"verified_dealer_id" integer,
	"app_role" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "bestcement"."kyc_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"aadhaar_number" varchar(20),
	"pan_number" varchar(20),
	"voter_id_number" varchar(20),
	"documents" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"remark" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."logistics_io" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone" varchar(255),
	"district" varchar(255),
	"destination" varchar(255),
	"doOrderDate" date,
	"doOrderTime" varchar(50),
	"gateInDate" date,
	"gateInTime" varchar(50),
	"processingTime" varchar(100),
	"wbInDate" date,
	"wbInTime" varchar(50),
	"diffGateInTareWt" varchar(100),
	"wbOutDate" date,
	"wbOutTime" varchar(50),
	"diffTareWtGrossWt" varchar(100),
	"gateOutDate" date,
	"gateOutTime" varchar(50),
	"gate_out_no_of_invoice" integer,
	"gate_out_invoice_nos" text[],
	"gate_out_bill_nos" text[],
	"diffGrossWtGateOut" varchar(100),
	"diffGrossWtInvoiceDT" varchar(100),
	"diffInvoiceDTGateOut" varchar(100),
	"diffGateInGateOut" varchar(100),
	"purpose" varchar(255),
	"type_of_materials" varchar(255),
	"vehicle_number" varchar(100),
	"store_date" date,
	"store_time" varchar(50),
	"no_of_invoice" integer,
	"party_name" varchar(255),
	"invoice_nos" text[],
	"bill_nos" text[],
	"source_name" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."logistics_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" varchar(255),
	"user_name" varchar(255) NOT NULL,
	"user_password" varchar(255) NOT NULL,
	"user_role" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "logistics_users_user_name_unique" UNIQUE("user_name")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."mason_on_scheme" (
	"mason_id" uuid NOT NULL,
	"scheme_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"status" varchar(50),
	"site_id" uuid,
	CONSTRAINT "mason_on_scheme_pkey" PRIMARY KEY("mason_id","scheme_id")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."mason_pc_side" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone_number" varchar(50) NOT NULL,
	"kyc_doc_name" varchar(100),
	"kyc_doc_id_num" varchar(150),
	"kyc_status" varchar(50) DEFAULT 'none',
	"bags_lifted" integer,
	"points_balance" integer DEFAULT 0,
	"is_referred" boolean,
	"referred_by_user" varchar(255),
	"referred_to_user" varchar(255),
	"dealer_id" varchar(255),
	"user_id" integer,
	"firebase_uid" varchar(128),
	"device_id" varchar(255),
	"fcm_token" varchar(500),
	CONSTRAINT "mason_pc_side_firebase_uid_key" UNIQUE("firebase_uid"),
	CONSTRAINT "mason_pc_side_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."mason_slab_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"scheme_slab_id" uuid NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"points_awarded" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."masons_on_meetings" (
	"mason_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"attended_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "masons_on_meetings_pkey" PRIMARY KEY("mason_id","meeting_id")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"reference_id" varchar(255),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"otp_code" varchar(10) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"mason_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."outstanding_reports" (
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
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"report_date" date,
	"temp_dealer_name" text,
	"email_report_id" uuid,
	"institution" varchar(10) DEFAULT 'UNKNOWN' NOT NULL,
	CONSTRAINT "unique_outstanding_entry" UNIQUE("is_account_jsb_jud","verified_dealer_id","report_date")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."permanent_journey_plans" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_date" date NOT NULL,
	"area_to_be_visited" varchar(500) NOT NULL,
	"description" varchar(500),
	"status" varchar(50) NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_by_id" integer NOT NULL,
	"verification_status" varchar(50),
	"additional_visit_remarks" varchar(500),
	"dealer_id" varchar(255),
	"bulk_op_id" varchar(50),
	"idempotency_key" varchar(120),
	"site_id" uuid,
	"route" varchar(500),
	"planned_new_site_visits" integer DEFAULT 0,
	"planned_follow_up_site_visits" integer DEFAULT 0,
	"planned_new_dealer_visits" integer DEFAULT 0,
	"planned_influencer_visits" integer DEFAULT 0,
	"influencer_name" varchar(255),
	"influencer_phone" varchar(20),
	"activity_type" varchar(255),
	"noof_converted_bags" integer DEFAULT 0,
	"noof_masonpc_in_schemes" integer DEFAULT 0,
	"diversion_reason" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "bestcement"."points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_id" uuid,
	"points" integer NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "points_ledger_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."projection_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution" varchar(10) NOT NULL,
	"report_date" date NOT NULL,
	"zone" varchar(100) NOT NULL,
	"order_dealer_name" varchar(255),
	"order_qty_mt" numeric(10, 2),
	"collection_dealer_name" varchar(255),
	"collection_amount" numeric(14, 2),
	"sales_promoter_user_id" integer,
	"source_message_id" text,
	"source_file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_dealer_id" integer,
	"user_id" integer,
	"email_report_id" uuid,
	CONSTRAINT "projection_reports_unique_key" UNIQUE("institution","report_date","zone","order_dealer_name","collection_dealer_name")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."projection_vs_actual_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_date" date NOT NULL,
	"institution" varchar(10) NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_dealer_id" integer,
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "bestcement"."ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"area" text NOT NULL,
	"region" text NOT NULL,
	"rating" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."reward_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	CONSTRAINT "reward_categories_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."reward_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mason_id" uuid NOT NULL,
	"reward_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'placed' NOT NULL,
	"points_debited" integer NOT NULL,
	"delivery_name" varchar(160),
	"delivery_phone" varchar(20),
	"delivery_address" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"fulfillment_notes" text
);
--> statement-breakpoint
CREATE TABLE "bestcement"."rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"point_cost" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"total_available_quantity" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"meta" jsonb,
	"category_id" integer,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "rewards_item_name_key" UNIQUE("item_name")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_role" varchar(100),
	"job_role" varchar(100),
	"granted_perms" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"perm_description" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bestcement"."sales_orders" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer,
	"dealer_id" varchar(255),
	"dvr_id" varchar(255),
	"pjp_id" varchar(255),
	"order_date" date NOT NULL,
	"order_party_name" varchar(255) NOT NULL,
	"party_phone_no" varchar(20),
	"party_area" varchar(255),
	"party_region" varchar(255),
	"party_address" varchar(500),
	"delivery_date" date,
	"delivery_area" varchar(255),
	"delivery_region" varchar(255),
	"delivery_address" varchar(500),
	"delivery_loc_pincode" varchar(10),
	"payment_mode" varchar(50),
	"payment_terms" varchar(500),
	"payment_amount" numeric(12, 2),
	"received_payment" numeric(12, 2),
	"received_payment_date" date,
	"pending_payment" numeric(12, 2),
	"order_qty" numeric(12, 3),
	"order_unit" varchar(20),
	"item_price" numeric(12, 2),
	"discount_percentage" numeric(5, 2),
	"item_price_after_discount" numeric(12, 2),
	"item_type" varchar(20),
	"item_grade" varchar(10),
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	"status" varchar(50) DEFAULT 'Pending'
);
--> statement-breakpoint
CREATE TABLE "bestcement"."sales_promoters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"mobile" varchar(20),
	"email" varchar(255),
	"zone" varchar(120),
	"district" varchar(120),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."salesman_attendance" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"attendance_date" date NOT NULL,
	"location_name" varchar(500) NOT NULL,
	"in_time_timestamp" timestamp(6) with time zone NOT NULL,
	"out_time_timestamp" timestamp(6) with time zone,
	"in_time_image_captured" boolean NOT NULL,
	"out_time_image_captured" boolean NOT NULL,
	"in_time_image_url" varchar(500),
	"out_time_image_url" varchar(500),
	"in_time_latitude" numeric(10, 7) NOT NULL,
	"in_time_longitude" numeric(10, 7) NOT NULL,
	"in_time_accuracy" numeric(10, 2),
	"in_time_speed" numeric(10, 2),
	"in_time_heading" numeric(10, 2),
	"in_time_altitude" numeric(10, 2),
	"out_time_latitude" numeric(10, 7),
	"out_time_longitude" numeric(10, 7),
	"out_time_accuracy" numeric(10, 2),
	"out_time_speed" numeric(10, 2),
	"out_time_heading" numeric(10, 2),
	"out_time_altitude" numeric(10, 2),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"role" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "bestcement"."salesman_leave_applications" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"leave_type" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" varchar(500) NOT NULL,
	"status" varchar(50) NOT NULL,
	"admin_remarks" varchar(500),
	"app_role" varchar(50),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."scheme_slabs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"min_bags_best" integer,
	"min_bags_others" integer,
	"points_earned" integer NOT NULL,
	"slab_description" varchar(255),
	"reward_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bestcement"."_SchemeToRewards" (
	"A" integer NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."schemes_offers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bestcement"."_SiteAssociatedDealers" (
	"A" varchar(255) NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."_SiteAssociatedMasons" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."_SiteAssociatedUsers" (
	"A" uuid NOT NULL,
	"B" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestcement"."sync_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_server_seq" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "one_row_only" CHECK (id = 1)
);
--> statement-breakpoint
CREATE TABLE "bestcement"."technical_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_name" varchar(255) NOT NULL,
	"concerned_person" varchar(255) NOT NULL,
	"phone_no" varchar(20) NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"site_type" varchar(50),
	"area" varchar(100),
	"region" varchar(100),
	"key_person_name" varchar(255),
	"key_person_phone_num" varchar(20),
	"stage_of_construction" varchar(100),
	"construction_start_date" date,
	"construction_end_date" date,
	"converted_site" boolean DEFAULT false,
	"first_visit_date" date,
	"last_visit_date" date,
	"need_follow_up" boolean DEFAULT false,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "bestcement"."technical_visit_reports" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"report_date" date NOT NULL,
	"visit_type" varchar(50) NOT NULL,
	"site_name_concerned_person" varchar(255) NOT NULL,
	"phone_no" varchar(20) NOT NULL,
	"email_id" varchar(255),
	"clients_remarks" varchar(500) NOT NULL,
	"salesperson_remarks" varchar(500) NOT NULL,
	"check_in_time" timestamp(6) with time zone NOT NULL,
	"check_out_time" timestamp(6) with time zone,
	"in_time_image_url" varchar(500),
	"out_time_image_url" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"associated_party_name" text,
	"channel_partner_visit" text,
	"conversion_from_brand" text,
	"conversion_quantity_unit" varchar(20),
	"conversion_quantity_value" numeric(10, 2),
	"promotional_activity" text,
	"quality_complaint" text,
	"service_type" text,
	"site_visit_stage" text,
	"site_visit_brand_in_use" text[] DEFAULT '{""}' NOT NULL,
	"influencer_type" text[] DEFAULT '{""}' NOT NULL,
	"site_visit_type" varchar(50),
	"dhalai_verification_code" varchar(50),
	"is_verification_status" varchar(50),
	"meeting_id" varchar(255),
	"pjp_id" varchar(255),
	"purpose_of_visit" varchar(500),
	"site_photo_url" varchar(500),
	"first_visit_time" timestamp with time zone,
	"last_visit_time" timestamp with time zone,
	"first_visit_day" varchar(100),
	"last_visit_day" varchar(100),
	"site_visits_count" integer,
	"other_visits_count" integer,
	"total_visits_count" integer,
	"region" varchar(100),
	"area" varchar(100),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"mason_id" uuid,
	"time_spent_in_loc" text,
	"site_id" uuid,
	"market_name" varchar(100),
	"site_address" varchar(500),
	"whatsapp_no" varchar(20),
	"visit_category" varchar(50),
	"customer_type" varchar(50),
	"const_area_sq_ft" integer,
	"current_brand_price" numeric(10, 2),
	"site_stock" numeric(10, 2),
	"est_requirement" numeric(10, 2),
	"supplying_dealer_name" varchar(255),
	"nearby_dealer_name" varchar(255),
	"is_converted" boolean,
	"conversion_type" varchar(50),
	"is_tech_service" boolean,
	"service_desc" varchar(500),
	"influencer_name" varchar(255),
	"influencer_phone" varchar(20),
	"is_scheme_enrolled" boolean,
	"influencer_productivity" varchar(100),
	"journey_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "bestcement"."tso_assignments" (
	"tso_id" integer NOT NULL,
	"mason_id" uuid NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tso_assignments_tso_id_mason_id_pk" PRIMARY KEY("tso_id","mason_id")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."tso_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(100),
	"date" date,
	"participants_count" integer,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now(),
	"updated_at" timestamp(6) with time zone DEFAULT now(),
	"site_id" uuid,
	"zone" varchar(100),
	"market" varchar(100),
	"dealer_name" varchar(255),
	"dealer_address" varchar(500),
	"conducted_by" varchar(255),
	"gift_type" varchar(255),
	"account_jsb_jud" varchar(100),
	"total_expenses" numeric(12, 2),
	"bill_submitted" boolean DEFAULT false,
	"meet_image_url" varchar(300)
);
--> statement-breakpoint
CREATE TABLE "bestcement"."user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"workos_user_id" text,
	"company_id" integer NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" text NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"phone_number" varchar(50),
	"inviteToken" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_dashboard_user" boolean DEFAULT false NOT NULL,
	"dashboard_login_id" text,
	"dashboard_hashed_password" text,
	"is_sales_app_user" boolean DEFAULT false NOT NULL,
	"salesman_login_id" text,
	"hashed_password" text,
	"is_technical_role" boolean DEFAULT false NOT NULL,
	"tech_login_id" text,
	"tech_hash_password" text,
	"is_admin_app_user" boolean DEFAULT false NOT NULL,
	"admin_app_login_id" text,
	"admin_app_hashed_password" text,
	"reports_to_id" integer,
	"area" text,
	"region" text,
	"no_of_pjp" integer,
	"device_id" varchar(255),
	"fcm_token" varchar(500),
	CONSTRAINT "uniq_user_device_id" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "bestcement"."verified_dealers" (
	"id" serial PRIMARY KEY NOT NULL,
	"dealer_party_name" varchar(255) NOT NULL,
	"alias" varchar(255),
	"gst_no" varchar(50),
	"pan_no" varchar(50),
	"zone" varchar(120),
	"district" varchar(120),
	"area" varchar(120),
	"state" varchar(100),
	"pin_code" varchar(20),
	"contact_no1" varchar(20),
	"contact_no2" varchar(20),
	"email" varchar(255),
	"contact_person" varchar(255),
	"dealer_segment" varchar(255),
	"sales_promoter_id" integer,
	"sales_man_name_raw" varchar(255),
	"credit_limit" numeric(14, 2),
	"credit_days_allowed" integer,
	"is_active" boolean DEFAULT true,
	"security_blank_cheque_no" varchar(255),
	"dealer_uuid" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bag_lifts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brands" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collection_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competition_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_visit_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "_DealerAssociatedMasons" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dealer_brand_mapping" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dealer_reports_and_scores" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dealers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "geo_tracking" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gift_allocation_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "journey_breadcrumbs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "journey_ops" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "journeys" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kyc_submissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "logistics_io" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "logistics_users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mason_on_scheme" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mason_pc_side" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mason_slab_achievements" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "masons_on_meetings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "otp_verifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outstanding_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "permanent_journey_plans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_ledger" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projection_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projection_vs_actual_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ratings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reward_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reward_redemptions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rewards" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales_orders" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales_promoters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "salesman_attendance" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "salesman_leave_applications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scheme_slabs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "_SchemeToRewards" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "schemes_offers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedDealers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedMasons" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedUsers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_state" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "technical_sites" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "technical_visit_reports" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tso_assignments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tso_meetings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verified_dealers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "auth_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "bag_lifts" CASCADE;--> statement-breakpoint
DROP TABLE "brands" CASCADE;--> statement-breakpoint
DROP TABLE "collection_reports" CASCADE;--> statement-breakpoint
DROP TABLE "companies" CASCADE;--> statement-breakpoint
DROP TABLE "competition_reports" CASCADE;--> statement-breakpoint
DROP TABLE "daily_tasks" CASCADE;--> statement-breakpoint
DROP TABLE "daily_visit_reports" CASCADE;--> statement-breakpoint
DROP TABLE "_DealerAssociatedMasons" CASCADE;--> statement-breakpoint
DROP TABLE "dealer_brand_mapping" CASCADE;--> statement-breakpoint
DROP TABLE "dealer_reports_and_scores" CASCADE;--> statement-breakpoint
DROP TABLE "dealers" CASCADE;--> statement-breakpoint
DROP TABLE "email_reports" CASCADE;--> statement-breakpoint
DROP TABLE "geo_tracking" CASCADE;--> statement-breakpoint
DROP TABLE "gift_allocation_logs" CASCADE;--> statement-breakpoint
DROP TABLE "journey_breadcrumbs" CASCADE;--> statement-breakpoint
DROP TABLE "journey_ops" CASCADE;--> statement-breakpoint
DROP TABLE "journeys" CASCADE;--> statement-breakpoint
DROP TABLE "kyc_submissions" CASCADE;--> statement-breakpoint
DROP TABLE "logistics_io" CASCADE;--> statement-breakpoint
DROP TABLE "logistics_users" CASCADE;--> statement-breakpoint
DROP TABLE "mason_on_scheme" CASCADE;--> statement-breakpoint
DROP TABLE "mason_pc_side" CASCADE;--> statement-breakpoint
DROP TABLE "mason_slab_achievements" CASCADE;--> statement-breakpoint
DROP TABLE "masons_on_meetings" CASCADE;--> statement-breakpoint
DROP TABLE "notifications" CASCADE;--> statement-breakpoint
DROP TABLE "otp_verifications" CASCADE;--> statement-breakpoint
DROP TABLE "outstanding_reports" CASCADE;--> statement-breakpoint
DROP TABLE "permanent_journey_plans" CASCADE;--> statement-breakpoint
DROP TABLE "points_ledger" CASCADE;--> statement-breakpoint
DROP TABLE "projection_reports" CASCADE;--> statement-breakpoint
DROP TABLE "projection_vs_actual_reports" CASCADE;--> statement-breakpoint
DROP TABLE "ratings" CASCADE;--> statement-breakpoint
DROP TABLE "reward_categories" CASCADE;--> statement-breakpoint
DROP TABLE "reward_redemptions" CASCADE;--> statement-breakpoint
DROP TABLE "rewards" CASCADE;--> statement-breakpoint
DROP TABLE "sales_orders" CASCADE;--> statement-breakpoint
DROP TABLE "sales_promoters" CASCADE;--> statement-breakpoint
DROP TABLE "salesman_attendance" CASCADE;--> statement-breakpoint
DROP TABLE "salesman_leave_applications" CASCADE;--> statement-breakpoint
DROP TABLE "scheme_slabs" CASCADE;--> statement-breakpoint
DROP TABLE "_SchemeToRewards" CASCADE;--> statement-breakpoint
DROP TABLE "schemes_offers" CASCADE;--> statement-breakpoint
DROP TABLE "_SiteAssociatedDealers" CASCADE;--> statement-breakpoint
DROP TABLE "_SiteAssociatedMasons" CASCADE;--> statement-breakpoint
DROP TABLE "_SiteAssociatedUsers" CASCADE;--> statement-breakpoint
DROP TABLE "sync_state" CASCADE;--> statement-breakpoint
DROP TABLE "technical_sites" CASCADE;--> statement-breakpoint
DROP TABLE "technical_visit_reports" CASCADE;--> statement-breakpoint
DROP TABLE "tso_assignments" CASCADE;--> statement-breakpoint
DROP TABLE "tso_meetings" CASCADE;--> statement-breakpoint
DROP TABLE "verified_dealers" CASCADE;--> statement-breakpoint
ALTER TABLE "public"."users" SET SCHEMA "bestcement";
--> statement-breakpoint
ALTER TABLE "bestcement"."users" RENAME TO "auth_sessions";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP CONSTRAINT "users_workos_user_id_unique";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP CONSTRAINT "users_inviteToken_unique";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP CONSTRAINT "users_salesman_login_id_unique";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP CONSTRAINT "users_tech_login_id_unique";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP CONSTRAINT "users_admin_app_login_id_unique";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP CONSTRAINT "users_device_id_unique";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP CONSTRAINT "users_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP CONSTRAINT "users_reports_to_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "bestcement"."users_companyid_email_unique";--> statement-breakpoint
DROP INDEX "bestcement"."idx_user_company_id";--> statement-breakpoint
DROP INDEX "bestcement"."idx_workos_user_id";--> statement-breakpoint
DROP INDEX "bestcement"."idx_user_device_id";--> statement-breakpoint
DROP INDEX "bestcement"."idx_users_reports_to_id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" ADD COLUMN "session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" ADD COLUMN "mason_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" ADD COLUMN "session_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bestcement"."bag_lifts" ADD CONSTRAINT "fk_bag_lifts_mason_id" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."bag_lifts" ADD CONSTRAINT "fk_bag_lifts_dealer_id" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."bag_lifts" ADD CONSTRAINT "fk_bag_lifts_approved_by" FOREIGN KEY ("approved_by") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."bag_lifts" ADD CONSTRAINT "bag_lifts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "bestcement"."technical_sites"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."collection_reports" ADD CONSTRAINT "collection_reports_sales_promoter_user_id_fkey" FOREIGN KEY ("sales_promoter_user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."collection_reports" ADD CONSTRAINT "collection_reports_verified_dealer_id_fkey" FOREIGN KEY ("verified_dealer_id") REFERENCES "bestcement"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."collection_reports" ADD CONSTRAINT "collection_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."collection_reports" ADD CONSTRAINT "fk_collection_email_report" FOREIGN KEY ("email_report_id") REFERENCES "bestcement"."email_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."competition_reports" ADD CONSTRAINT "competition_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."daily_tasks" ADD CONSTRAINT "daily_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."daily_tasks" ADD CONSTRAINT "daily_tasks_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_sub_dealer_id_dealers_id_fk" FOREIGN KEY ("sub_dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_pjp_id_permanent_journey_plans_id_fk" FOREIGN KEY ("pjp_id") REFERENCES "bestcement"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_daily_task_id_daily_tasks_id_fk" FOREIGN KEY ("daily_task_id") REFERENCES "bestcement"."daily_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."_DealerAssociatedMasons" ADD CONSTRAINT "_DealerAssociatedMasons_A_fkey" FOREIGN KEY ("A") REFERENCES "bestcement"."dealers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."_DealerAssociatedMasons" ADD CONSTRAINT "_DealerAssociatedMasons_B_fkey" FOREIGN KEY ("B") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."dealer_brand_mapping" ADD CONSTRAINT "dealer_brand_mapping_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."dealer_brand_mapping" ADD CONSTRAINT "dealer_brand_mapping_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."dealer_brand_mapping" ADD CONSTRAINT "dealer_brand_mapping_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "bestcement"."brands"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."dealer_brand_mapping" ADD CONSTRAINT "fk_dbm_verified_dealer" FOREIGN KEY ("verified_dealer_id") REFERENCES "bestcement"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."dealer_reports_and_scores" ADD CONSTRAINT "dealer_reports_and_scores_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."dealers" ADD CONSTRAINT "dealers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."dealers" ADD CONSTRAINT "dealers_parent_dealer_id_fkey" FOREIGN KEY ("parent_dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."geo_tracking" ADD CONSTRAINT "geo_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."geo_tracking" ADD CONSTRAINT "geo_tracking_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "bestcement"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."geo_tracking" ADD CONSTRAINT "geo_tracking_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."geo_tracking" ADD CONSTRAINT "geo_tracking_linked_journey_id_fkey" FOREIGN KEY ("linked_journey_id") REFERENCES "bestcement"."journeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."gift_allocation_logs" ADD CONSTRAINT "fk_gift_logs_user" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."gift_allocation_logs" ADD CONSTRAINT "fk_gift_logs_source_user" FOREIGN KEY ("source_user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."gift_allocation_logs" ADD CONSTRAINT "fk_gift_logs_dest_user" FOREIGN KEY ("destination_user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."gift_allocation_logs" ADD CONSTRAINT "fk_gift_allocation_logs_reward_id" FOREIGN KEY ("reward_id") REFERENCES "bestcement"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."journey_breadcrumbs" ADD CONSTRAINT "journey_breadcrumbs_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "bestcement"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."journey_ops" ADD CONSTRAINT "fk_journey_ops_user" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."journeys" ADD CONSTRAINT "journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."kyc_submissions" ADD CONSTRAINT "fk_kyc_submissions_mason_id" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."mason_on_scheme" ADD CONSTRAINT "fk_mos_mason" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."mason_on_scheme" ADD CONSTRAINT "fk_mos_scheme" FOREIGN KEY ("scheme_id") REFERENCES "bestcement"."schemes_offers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."mason_on_scheme" ADD CONSTRAINT "mason_on_scheme_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "bestcement"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."mason_pc_side" ADD CONSTRAINT "fk_mason_dealer" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."mason_pc_side" ADD CONSTRAINT "fk_mason_user" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."mason_slab_achievements" ADD CONSTRAINT "mason_slab_achievements_mason_id_fkey" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."mason_slab_achievements" ADD CONSTRAINT "mason_slab_achievements_scheme_slab_id_fkey" FOREIGN KEY ("scheme_slab_id") REFERENCES "bestcement"."scheme_slabs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."masons_on_meetings" ADD CONSTRAINT "fk_mom_mason" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."masons_on_meetings" ADD CONSTRAINT "fk_mom_meeting" FOREIGN KEY ("meeting_id") REFERENCES "bestcement"."tso_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."otp_verifications" ADD CONSTRAINT "fk_otp_mason" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ADD CONSTRAINT "fk_outstanding_verified_dealer" FOREIGN KEY ("verified_dealer_id") REFERENCES "bestcement"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ADD CONSTRAINT "fk_outstanding_collection_report" FOREIGN KEY ("collection_report_id") REFERENCES "bestcement"."collection_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ADD CONSTRAINT "fk_outstanding_dvr" FOREIGN KEY ("dvr_id") REFERENCES "bestcement"."daily_visit_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."outstanding_reports" ADD CONSTRAINT "fk_outstanding_email_report" FOREIGN KEY ("email_report_id") REFERENCES "bestcement"."email_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."permanent_journey_plans" ADD CONSTRAINT "fk_pjp_dealer_id" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "bestcement"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."permanent_journey_plans" ADD CONSTRAINT "permanent_journey_plans_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "bestcement"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."points_ledger" ADD CONSTRAINT "fk_points_ledger_mason_id" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."projection_reports" ADD CONSTRAINT "projection_reports_verified_dealer_id_fkey" FOREIGN KEY ("verified_dealer_id") REFERENCES "bestcement"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."projection_reports" ADD CONSTRAINT "projection_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."projection_reports" ADD CONSTRAINT "fk_projection_email_report" FOREIGN KEY ("email_report_id") REFERENCES "bestcement"."email_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."projection_vs_actual_reports" ADD CONSTRAINT "projection_vs_actual_reports_verified_dealer_id_fkey" FOREIGN KEY ("verified_dealer_id") REFERENCES "bestcement"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."projection_vs_actual_reports" ADD CONSTRAINT "projection_vs_actual_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."ratings" ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."reward_redemptions" ADD CONSTRAINT "fk_reward_redemptions_mason_id" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."reward_redemptions" ADD CONSTRAINT "fk_reward_redemptions_reward_id" FOREIGN KEY ("reward_id") REFERENCES "bestcement"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."rewards" ADD CONSTRAINT "fk_rewards_category_id" FOREIGN KEY ("category_id") REFERENCES "bestcement"."reward_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_orders" ADD CONSTRAINT "fk_sales_orders_user" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_orders" ADD CONSTRAINT "fk_sales_orders_dealer" FOREIGN KEY ("dealer_id") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_orders" ADD CONSTRAINT "fk_sales_orders_dvr" FOREIGN KEY ("dvr_id") REFERENCES "bestcement"."daily_visit_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_orders" ADD CONSTRAINT "fk_sales_orders_pjp" FOREIGN KEY ("pjp_id") REFERENCES "bestcement"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."salesman_attendance" ADD CONSTRAINT "salesman_attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."salesman_leave_applications" ADD CONSTRAINT "salesman_leave_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."scheme_slabs" ADD CONSTRAINT "scheme_slabs_scheme_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "bestcement"."schemes_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."scheme_slabs" ADD CONSTRAINT "scheme_slabs_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "bestcement"."rewards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."_SchemeToRewards" ADD CONSTRAINT "_SchemeToRewards_A_fkey" FOREIGN KEY ("A") REFERENCES "bestcement"."rewards"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."_SchemeToRewards" ADD CONSTRAINT "_SchemeToRewards_B_fkey" FOREIGN KEY ("B") REFERENCES "bestcement"."schemes_offers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."_SiteAssociatedDealers" ADD CONSTRAINT "_SiteAssociatedDealers_A_fkey" FOREIGN KEY ("A") REFERENCES "bestcement"."dealers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."_SiteAssociatedDealers" ADD CONSTRAINT "_SiteAssociatedDealers_B_fkey" FOREIGN KEY ("B") REFERENCES "bestcement"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."_SiteAssociatedMasons" ADD CONSTRAINT "_SiteAssociatedMasons_A_fkey" FOREIGN KEY ("A") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."_SiteAssociatedMasons" ADD CONSTRAINT "_SiteAssociatedMasons_B_fkey" FOREIGN KEY ("B") REFERENCES "bestcement"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."_SiteAssociatedUsers" ADD CONSTRAINT "_SiteAssociatedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "bestcement"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."_SiteAssociatedUsers" ADD CONSTRAINT "_SiteAssociatedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."technical_visit_reports" ADD CONSTRAINT "technical_visit_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."technical_visit_reports" ADD CONSTRAINT "fk_technical_visit_reports_pjp_id" FOREIGN KEY ("pjp_id") REFERENCES "bestcement"."permanent_journey_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."technical_visit_reports" ADD CONSTRAINT "technical_visit_reports_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "bestcement"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."tso_assignments" ADD CONSTRAINT "tso_assignments_tso_id_users_id_fk" FOREIGN KEY ("tso_id") REFERENCES "bestcement"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."tso_assignments" ADD CONSTRAINT "tso_assignments_mason_id_mason_pc_side_id_fk" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."tso_meetings" ADD CONSTRAINT "fk_tso_meetings_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "bestcement"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."tso_meetings" ADD CONSTRAINT "tso_meetings_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "bestcement"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "bestcement"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "bestcement"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "bestcement"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."users" ADD CONSTRAINT "users_reports_to_id_fkey" FOREIGN KEY ("reports_to_id") REFERENCES "bestcement"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bestcement"."verified_dealers" ADD CONSTRAINT "verified_dealers_sales_promoter_id_sales_promoters_id_fk" FOREIGN KEY ("sales_promoter_id") REFERENCES "bestcement"."sales_promoters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."verified_dealers" ADD CONSTRAINT "verified_dealers_dealer_uuid_dealers_id_fk" FOREIGN KEY ("dealer_uuid") REFERENCES "bestcement"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_dealer_id" ON "bestcement"."bag_lifts" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_mason_id" ON "bestcement"."bag_lifts" USING btree ("mason_id");--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_site_id" ON "bestcement"."bag_lifts" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_status" ON "bestcement"."bag_lifts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_brand_name_key" ON "bestcement"."brands" USING btree ("brand_name");--> statement-breakpoint
CREATE INDEX "idx_collection_date" ON "bestcement"."collection_reports" USING btree ("voucher_date");--> statement-breakpoint
CREATE INDEX "idx_collection_email_report" ON "bestcement"."collection_reports" USING btree ("email_report_id");--> statement-breakpoint
CREATE INDEX "idx_collection_institution" ON "bestcement"."collection_reports" USING btree ("institution");--> statement-breakpoint
CREATE INDEX "idx_collection_user" ON "bestcement"."collection_reports" USING btree ("sales_promoter_user_id");--> statement-breakpoint
CREATE INDEX "idx_collection_verified_dealer" ON "bestcement"."collection_reports" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_collection_voucher" ON "bestcement"."collection_reports" USING btree ("voucher_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_collection_voucher_inst" ON "bestcement"."collection_reports" USING btree ("voucher_no","institution");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_admin_user_id_key" ON "bestcement"."companies" USING btree ("admin_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_workos_organization_id_key" ON "bestcement"."companies" USING btree ("workos_organization_id");--> statement-breakpoint
CREATE INDEX "idx_admin_user_id" ON "bestcement"."companies" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "competition_reports_user_id_idx" ON "bestcement"."competition_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_user" ON "bestcement"."daily_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_dealer" ON "bestcement"."daily_tasks" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_date" ON "bestcement"."daily_tasks" USING btree ("task_date");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_zone" ON "bestcement"."daily_tasks" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_week" ON "bestcement"."daily_tasks" USING btree ("week");--> statement-breakpoint
CREATE INDEX "idx_daily_tasks_pjp_batch" ON "bestcement"."daily_tasks" USING btree ("pjp_batch_id");--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_user_id" ON "bestcement"."daily_visit_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daily_visit_reports_pjp_id" ON "bestcement"."daily_visit_reports" USING btree ("pjp_id");--> statement-breakpoint
CREATE INDEX "idx_dvr_dealer_id" ON "bestcement"."daily_visit_reports" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_dvr_sub_dealer_id" ON "bestcement"."daily_visit_reports" USING btree ("sub_dealer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "_DealerAssociatedMasons_AB_unique" ON "bestcement"."_DealerAssociatedMasons" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_DealerAssociatedMasons_B_index" ON "bestcement"."_DealerAssociatedMasons" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_brand_mapping_dealer_id_brand_id_key" ON "bestcement"."dealer_brand_mapping" USING btree ("dealer_id","brand_id");--> statement-breakpoint
CREATE INDEX "dealer_brand_mapping_user_id_idx" ON "bestcement"."dealer_brand_mapping" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dbm_verified_dealer_id" ON "bestcement"."dealer_brand_mapping" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_reports_and_scores_dealer_id_key" ON "bestcement"."dealer_reports_and_scores" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_dealers_parent_dealer_id" ON "bestcement"."dealers" USING btree ("parent_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_dealers_user_id" ON "bestcement"."dealers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_reports_message" ON "bestcement"."email_reports" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_geo_active" ON "bestcement"."geo_tracking" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_geo_dealer_id" ON "bestcement"."geo_tracking" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_geo_journey_time" ON "bestcement"."geo_tracking" USING btree ("journey_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_geo_linked_journey_time" ON "bestcement"."geo_tracking" USING btree ("linked_journey_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_geo_site_id" ON "bestcement"."geo_tracking" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_geo_tracking_recorded_at" ON "bestcement"."geo_tracking" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_geo_tracking_user_id" ON "bestcement"."geo_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_geo_user_time" ON "bestcement"."geo_tracking" USING btree ("user_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_gift_allocation_logs_destination_user_id" ON "bestcement"."gift_allocation_logs" USING btree ("destination_user_id");--> statement-breakpoint
CREATE INDEX "idx_gift_allocation_logs_gift_id" ON "bestcement"."gift_allocation_logs" USING btree ("gift_id");--> statement-breakpoint
CREATE INDEX "idx_gift_allocation_logs_source_user_id" ON "bestcement"."gift_allocation_logs" USING btree ("source_user_id");--> statement-breakpoint
CREATE INDEX "idx_gift_allocation_logs_user_id" ON "bestcement"."gift_allocation_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_breadcrumbs_h3" ON "bestcement"."journey_breadcrumbs" USING btree ("h3_index");--> statement-breakpoint
CREATE INDEX "idx_breadcrumbs_journey_time" ON "bestcement"."journey_breadcrumbs" USING btree ("journey_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_created" ON "bestcement"."journey_ops" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_journey" ON "bestcement"."journey_ops" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_server_seq" ON "bestcement"."journey_ops" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_user" ON "bestcement"."journey_ops" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_journeys_user_status" ON "bestcement"."journeys" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_kyc_submissions_mason_id" ON "bestcement"."kyc_submissions" USING btree ("mason_id");--> statement-breakpoint
CREATE INDEX "idx_mos_site_id" ON "bestcement"."mason_on_scheme" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_msa_mason_id" ON "bestcement"."mason_slab_achievements" USING btree ("mason_id");--> statement-breakpoint
CREATE INDEX "idx_msa_slab_id" ON "bestcement"."mason_slab_achievements" USING btree ("scheme_slab_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_mason_slab_claim" ON "bestcement"."mason_slab_achievements" USING btree ("mason_id","scheme_slab_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "bestcement"."notifications" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_otp_verifications_mason_id" ON "bestcement"."otp_verifications" USING btree ("mason_id");--> statement-breakpoint
CREATE INDEX "idx_outstanding_collection_report" ON "bestcement"."outstanding_reports" USING btree ("collection_report_id");--> statement-breakpoint
CREATE INDEX "idx_outstanding_dvr" ON "bestcement"."outstanding_reports" USING btree ("dvr_id");--> statement-breakpoint
CREATE INDEX "idx_outstanding_email_report" ON "bestcement"."outstanding_reports" USING btree ("email_report_id");--> statement-breakpoint
CREATE INDEX "idx_outstanding_verified_dealer" ON "bestcement"."outstanding_reports" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_permanent_journey_plans_created_by_id" ON "bestcement"."permanent_journey_plans" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_permanent_journey_plans_user_id" ON "bestcement"."permanent_journey_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pjp_bulk_op_id" ON "bestcement"."permanent_journey_plans" USING btree ("bulk_op_id");--> statement-breakpoint
CREATE INDEX "idx_pjp_dealer_id" ON "bestcement"."permanent_journey_plans" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_pjp_site_id" ON "bestcement"."permanent_journey_plans" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_pjp_idempotency_key_not_null" ON "bestcement"."permanent_journey_plans" USING btree ("idempotency_key") WHERE (idempotency_key IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_pjp_user_dealer_plan_date" ON "bestcement"."permanent_journey_plans" USING btree ("user_id","dealer_id","plan_date");--> statement-breakpoint
CREATE INDEX "idx_points_ledger_mason_id" ON "bestcement"."points_ledger" USING btree ("mason_id");--> statement-breakpoint
CREATE INDEX "idx_points_ledger_source_id" ON "bestcement"."points_ledger" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_projection_date" ON "bestcement"."projection_reports" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "idx_projection_email_report" ON "bestcement"."projection_reports" USING btree ("email_report_id");--> statement-breakpoint
CREATE INDEX "idx_projection_institution" ON "bestcement"."projection_reports" USING btree ("institution");--> statement-breakpoint
CREATE INDEX "idx_projection_user" ON "bestcement"."projection_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projection_verified_dealer" ON "bestcement"."projection_reports" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_projection_zone" ON "bestcement"."projection_reports" USING btree ("zone");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_projection_snapshot" ON "bestcement"."projection_reports" USING btree ("report_date","order_dealer_name","collection_dealer_name","institution");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_date" ON "bestcement"."projection_vs_actual_reports" USING btree ("report_date");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_dealer" ON "bestcement"."projection_vs_actual_reports" USING btree ("dealer_name");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_institution" ON "bestcement"."projection_vs_actual_reports" USING btree ("institution");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_user" ON "bestcement"."projection_vs_actual_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_verified_dealer" ON "bestcement"."projection_vs_actual_reports" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_zone" ON "bestcement"."projection_vs_actual_reports" USING btree ("zone");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_proj_actual_snapshot" ON "bestcement"."projection_vs_actual_reports" USING btree ("report_date","dealer_name","institution");--> statement-breakpoint
CREATE INDEX "idx_reward_redemptions_mason_id" ON "bestcement"."reward_redemptions" USING btree ("mason_id");--> statement-breakpoint
CREATE INDEX "idx_reward_redemptions_status" ON "bestcement"."reward_redemptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rewards_category_id" ON "bestcement"."rewards" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_dealer_id" ON "bestcement"."sales_orders" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_dvr_id" ON "bestcement"."sales_orders" USING btree ("dvr_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_order_date" ON "bestcement"."sales_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_pjp_id" ON "bestcement"."sales_orders" USING btree ("pjp_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_user_id" ON "bestcement"."sales_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_salesman_attendance_user_id" ON "bestcement"."salesman_attendance" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_salesman_leave_applications_user_id" ON "bestcement"."salesman_leave_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_scheme_slabs_reward_id" ON "bestcement"."scheme_slabs" USING btree ("reward_id");--> statement-breakpoint
CREATE INDEX "idx_scheme_slabs_scheme_id" ON "bestcement"."scheme_slabs" USING btree ("scheme_id");--> statement-breakpoint
CREATE UNIQUE INDEX "_SchemeToRewards_AB_unique" ON "bestcement"."_SchemeToRewards" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_SchemeToRewards_B_index" ON "bestcement"."_SchemeToRewards" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedDealers_AB_unique" ON "bestcement"."_SiteAssociatedDealers" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_SiteAssociatedDealers_B_index" ON "bestcement"."_SiteAssociatedDealers" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedMasons_AB_unique" ON "bestcement"."_SiteAssociatedMasons" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_SiteAssociatedMasons_B_index" ON "bestcement"."_SiteAssociatedMasons" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedUsers_AB_unique" ON "bestcement"."_SiteAssociatedUsers" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_SiteAssociatedUsers_B_index" ON "bestcement"."_SiteAssociatedUsers" USING btree ("B");--> statement-breakpoint
CREATE INDEX "idx_technical_visit_reports_meeting_id" ON "bestcement"."technical_visit_reports" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_technical_visit_reports_pjp_id" ON "bestcement"."technical_visit_reports" USING btree ("pjp_id");--> statement-breakpoint
CREATE INDEX "idx_technical_visit_reports_user_id" ON "bestcement"."technical_visit_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tvr_journey_id" ON "bestcement"."technical_visit_reports" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "idx_tvr_site_id" ON "bestcement"."technical_visit_reports" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_tso_assignments_tso_id" ON "bestcement"."tso_assignments" USING btree ("tso_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_site_id" ON "bestcement"."tso_meetings" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_tso_meetings_created_by_user_id" ON "bestcement"."tso_meetings" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_user_company_id" ON "bestcement"."users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_user_device_id" ON "bestcement"."users" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_workos_user_id" ON "bestcement"."users" USING btree ("workos_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_company_id_email_key" ON "bestcement"."users" USING btree ("company_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_inviteToken_key" ON "bestcement"."users" USING btree ("inviteToken");--> statement-breakpoint
CREATE UNIQUE INDEX "users_salesman_login_id_key" ON "bestcement"."users" USING btree ("salesman_login_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_workos_user_id_key" ON "bestcement"."users" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX "idx_users_reports_to_id" ON "bestcement"."users" USING btree ("reports_to_id");--> statement-breakpoint
CREATE INDEX "idx_verified_zone" ON "bestcement"."verified_dealers" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "idx_verified_district" ON "bestcement"."verified_dealers" USING btree ("district");--> statement-breakpoint
CREATE INDEX "idx_verified_pincode" ON "bestcement"."verified_dealers" USING btree ("pin_code");--> statement-breakpoint
CREATE INDEX "idx_verified_sales_promoter" ON "bestcement"."verified_dealers" USING btree ("sales_promoter_id");--> statement-breakpoint
CREATE INDEX "idx_verified_segment" ON "bestcement"."verified_dealers" USING btree ("dealer_segment");--> statement-breakpoint
CREATE INDEX "idx_verified_gst" ON "bestcement"."verified_dealers" USING btree ("gst_no");--> statement-breakpoint
CREATE INDEX "idx_verified_mobile" ON "bestcement"."verified_dealers" USING btree ("contact_no1");--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" ADD CONSTRAINT "auth_sessions_mason_id_fkey" FOREIGN KEY ("mason_id") REFERENCES "bestcement"."mason_pc_side"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "workos_user_id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "company_id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "last_name";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "inviteToken";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "region";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "area";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "salesman_login_id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "hashed_password";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "is_technical_role";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "tech_login_id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "tech_hash_password";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "is_admin_app_user";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "admin_app_login_id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "admin_app_hashed_password";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "device_id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "fcm_token";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "reports_to_id";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" DROP COLUMN "no_of_pjp";--> statement-breakpoint
ALTER TABLE "bestcement"."auth_sessions" ADD CONSTRAINT "auth_sessions_session_token_key" UNIQUE("session_token");