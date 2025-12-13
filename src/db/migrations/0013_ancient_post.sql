CREATE TABLE "aoi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lon" double precision NOT NULL,
	"radius_km" double precision NOT NULL,
	"boundary_geojson" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aoi_grid_cell" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"cell_row" integer NOT NULL,
	"cell_col" integer NOT NULL,
	"centroid_lat" double precision NOT NULL,
	"centroid_lon" double precision NOT NULL,
	"geometry_geojson" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "construction_site" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"grid_cell_id" uuid,
	"source_type" text NOT NULL,
	"source_building_id" uuid,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"geom_geojson" jsonb,
	"estimated_area_sq_m" double precision,
	"first_seen_date" date NOT NULL,
	"last_seen_date" date NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"verified_by_tso_id" integer,
	"verified_at" timestamp with time zone,
	"linked_dealer_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detected_building" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"highres_scene_id" uuid NOT NULL,
	"aoi_id" uuid NOT NULL,
	"grid_cell_id" uuid,
	"centroid_lat" double precision NOT NULL,
	"centroid_lon" double precision NOT NULL,
	"footprint_geojson" jsonb NOT NULL,
	"area_sq_m" double precision NOT NULL,
	"detection_confidence" double precision,
	"status" text DEFAULT 'auto_detected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grid_change_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"grid_cell_id" uuid NOT NULL,
	"earlier_scene_id" uuid NOT NULL,
	"later_scene_id" uuid NOT NULL,
	"t0_acquisition_datetime" timestamp with time zone NOT NULL,
	"t1_acquisition_datetime" timestamp with time zone NOT NULL,
	"ndvi_drop_mean" double precision,
	"ndvi_drop_fraction" double precision,
	"change_score" double precision,
	"is_hot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "highres_scene" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"grid_cell_id" uuid,
	"provider" text NOT NULL,
	"acquisition_datetime" timestamp with time zone NOT NULL,
	"resolution_m" double precision NOT NULL,
	"bbox_min_lon" double precision NOT NULL,
	"bbox_min_lat" double precision NOT NULL,
	"bbox_max_lon" double precision NOT NULL,
	"bbox_max_lat" double precision NOT NULL,
	"r2_bucket" text NOT NULL,
	"r2_key" text NOT NULL,
	"raw_metadata_json" jsonb,
	"is_downloaded" boolean DEFAULT false NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "satellite_scene" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aoi_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"stac_id" text NOT NULL,
	"stac_collection" text NOT NULL,
	"acquisition_datetime" timestamp with time zone NOT NULL,
	"cloud_cover_percent" double precision,
	"bbox_min_lon" double precision NOT NULL,
	"bbox_min_lat" double precision NOT NULL,
	"bbox_max_lon" double precision NOT NULL,
	"bbox_max_lat" double precision NOT NULL,
	"crs_epsg" integer,
	"native_resolution_m" double precision,
	"r2_bucket" text NOT NULL,
	"r2_prefix" text NOT NULL,
	"red_band_key" text NOT NULL,
	"nir_band_key" text NOT NULL,
	"green_band_key" text,
	"blue_band_key" text,
	"rgb_preview_key" text,
	"stac_properties" jsonb,
	"stac_assets" jsonb,
	"is_downloaded" boolean DEFAULT false NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"is_deleted_from_r2" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tso_visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"tso_id" integer NOT NULL,
	"visited_at" timestamp with time zone NOT NULL,
	"visit_outcome" text NOT NULL,
	"comments" text,
	"photo_urls" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aoi_grid_cell" ADD CONSTRAINT "aoi_grid_cell_aoi_id_aoi_id_fk" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_site" ADD CONSTRAINT "construction_site_aoi_id_aoi_id_fk" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_site" ADD CONSTRAINT "construction_site_grid_cell_id_aoi_grid_cell_id_fk" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."aoi_grid_cell"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_site" ADD CONSTRAINT "construction_site_source_building_id_detected_building_id_fk" FOREIGN KEY ("source_building_id") REFERENCES "public"."detected_building"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_building" ADD CONSTRAINT "detected_building_highres_scene_id_highres_scene_id_fk" FOREIGN KEY ("highres_scene_id") REFERENCES "public"."highres_scene"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_building" ADD CONSTRAINT "detected_building_aoi_id_aoi_id_fk" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_building" ADD CONSTRAINT "detected_building_grid_cell_id_aoi_grid_cell_id_fk" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."aoi_grid_cell"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_change_score" ADD CONSTRAINT "grid_change_score_aoi_id_aoi_id_fk" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_change_score" ADD CONSTRAINT "grid_change_score_grid_cell_id_aoi_grid_cell_id_fk" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."aoi_grid_cell"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_change_score" ADD CONSTRAINT "grid_change_score_earlier_scene_id_satellite_scene_id_fk" FOREIGN KEY ("earlier_scene_id") REFERENCES "public"."satellite_scene"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_change_score" ADD CONSTRAINT "grid_change_score_later_scene_id_satellite_scene_id_fk" FOREIGN KEY ("later_scene_id") REFERENCES "public"."satellite_scene"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highres_scene" ADD CONSTRAINT "highres_scene_aoi_id_aoi_id_fk" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highres_scene" ADD CONSTRAINT "highres_scene_grid_cell_id_aoi_grid_cell_id_fk" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."aoi_grid_cell"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satellite_scene" ADD CONSTRAINT "satellite_scene_aoi_id_aoi_id_fk" FOREIGN KEY ("aoi_id") REFERENCES "public"."aoi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tso_visit" ADD CONSTRAINT "tso_visit_site_id_construction_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."construction_site"("id") ON DELETE cascade ON UPDATE no action;