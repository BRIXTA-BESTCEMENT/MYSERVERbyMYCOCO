ALTER TABLE "bag_lifts" ADD COLUMN "site_id" uuid;--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD COLUMN "site_key_person_name" varchar(255);--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD COLUMN "site_key_person_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD COLUMN "verification_site_image_url" text;--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD COLUMN "verification_proof_image_url" text;--> statement-breakpoint
ALTER TABLE "technical_sites" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "bag_lifts" ADD CONSTRAINT "bag_lifts_site_id_technical_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."technical_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bag_lifts_site_id" ON "bag_lifts" USING btree ("site_id");