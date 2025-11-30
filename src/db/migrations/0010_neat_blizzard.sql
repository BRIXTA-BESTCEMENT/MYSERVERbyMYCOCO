ALTER TABLE "dealers" DROP CONSTRAINT "dealers_site_id_technical_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "mason_pc_side" DROP CONSTRAINT "mason_pc_side_site_id_technical_sites_id_fk";
--> statement-breakpoint
ALTER TABLE "technical_sites" DROP CONSTRAINT "technical_sites_related_dealer_id_dealers_id_fk";
--> statement-breakpoint
ALTER TABLE "technical_sites" DROP CONSTRAINT "technical_sites_related_mason_pc_id_mason_pc_side_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_site_id_technical_sites_id_fk";
--> statement-breakpoint
DROP INDEX "idx_dealers_site_id";--> statement-breakpoint
DROP INDEX "idx_mason_pc_side_site_id";--> statement-breakpoint
DROP INDEX "idx_technical_sites_dealer_id";--> statement-breakpoint
DROP INDEX "idx_technical_sites_mason_id";--> statement-breakpoint
DROP INDEX "idx_user_site_id";--> statement-breakpoint
ALTER TABLE "dealers" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "mason_pc_side" DROP COLUMN "site_id";--> statement-breakpoint
ALTER TABLE "technical_sites" DROP COLUMN "related_dealer_id";--> statement-breakpoint
ALTER TABLE "technical_sites" DROP COLUMN "related_mason_pc_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "site_id";