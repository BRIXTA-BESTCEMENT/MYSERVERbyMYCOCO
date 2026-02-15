ALTER TABLE "collection_reports" DROP CONSTRAINT "collection_reports_dealer_id_dealers_id_fk";
--> statement-breakpoint
ALTER TABLE "projection_reports" DROP CONSTRAINT "projection_reports_dealer_id_dealers_id_fk";
--> statement-breakpoint
DROP INDEX "idx_collection_dealer";--> statement-breakpoint
DROP INDEX "idx_projection_dealer";--> statement-breakpoint
DROP INDEX "idx_proj_actual_dealer";--> statement-breakpoint
ALTER TABLE "collection_reports" ADD COLUMN "verified_dealer_id" integer;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "projection_reports" ADD COLUMN "verified_dealer_id" integer;--> statement-breakpoint
ALTER TABLE "projection_reports" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "projection_vs_actual_reports" ADD COLUMN "verified_dealer_id" integer;--> statement-breakpoint
ALTER TABLE "projection_vs_actual_reports" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_verified_dealer_id_verified_dealers_id_fk" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_reports" ADD CONSTRAINT "collection_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_reports" ADD CONSTRAINT "projection_reports_verified_dealer_id_verified_dealers_id_fk" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_reports" ADD CONSTRAINT "projection_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_vs_actual_reports" ADD CONSTRAINT "projection_vs_actual_reports_verified_dealer_id_verified_dealers_id_fk" FOREIGN KEY ("verified_dealer_id") REFERENCES "public"."verified_dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projection_vs_actual_reports" ADD CONSTRAINT "projection_vs_actual_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_collection_verified_dealer" ON "collection_reports" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_collection_user" ON "collection_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projection_verified_dealer" ON "projection_reports" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_projection_user" ON "projection_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_verified_dealer" ON "projection_vs_actual_reports" USING btree ("verified_dealer_id");--> statement-breakpoint
CREATE INDEX "idx_proj_actual_user" ON "projection_vs_actual_reports" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "collection_reports" DROP COLUMN "dealer_id";--> statement-breakpoint
ALTER TABLE "projection_reports" DROP COLUMN "dealer_id";