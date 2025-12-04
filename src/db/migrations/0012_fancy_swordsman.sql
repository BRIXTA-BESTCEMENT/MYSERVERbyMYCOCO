ALTER TABLE "geo_tracking" ADD COLUMN "dealer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "geo_tracking" ADD CONSTRAINT "geo_tracking_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_geo_tracking_dealer_id" ON "geo_tracking" USING btree ("dealer_id");