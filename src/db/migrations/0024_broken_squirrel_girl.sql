ALTER TABLE "journey_ops" DROP CONSTRAINT "journey_ops_journey_id_journeys_id_fk";
--> statement-breakpoint
ALTER TABLE "journey_breadcrumbs" ALTER COLUMN "latitude" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "journey_breadcrumbs" ALTER COLUMN "longitude" SET DATA TYPE double precision;