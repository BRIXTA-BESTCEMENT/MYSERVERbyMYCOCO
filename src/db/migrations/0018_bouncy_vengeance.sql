CREATE TABLE "journey_breadcrumbs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"h3_index" varchar(15),
	"speed" real,
	"accuracy" real,
	"heading" real,
	"altitude" real,
	"battery_level" real,
	"is_charging" boolean,
	"network_status" varchar(50),
	"is_mocked" boolean DEFAULT false,
	"recorded_at" timestamp (6) with time zone NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "journeys" (
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
	"start_time" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"end_time" timestamp (6) with time zone,
	"total_distance" numeric(10, 3) DEFAULT '0',
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD COLUMN "linked_journey_id" varchar(255);--> statement-breakpoint
ALTER TABLE "journey_breadcrumbs" ADD CONSTRAINT "journey_breadcrumbs_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_breadcrumbs_journey_time" ON "journey_breadcrumbs" USING btree ("journey_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_breadcrumbs_h3" ON "journey_breadcrumbs" USING btree ("h3_index");--> statement-breakpoint
CREATE INDEX "idx_journeys_user_status" ON "journeys" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_linked_journey_id_journeys_id_fk" FOREIGN KEY ("linked_journey_id") REFERENCES "public"."journeys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_geo_linked_journey_time" ON "geo_tracking" USING btree ("linked_journey_id","recorded_at");