CREATE TABLE "_DealerAssociatedMasons" (
	"A" varchar(255) NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_SiteAssociatedDealers" (
	"A" varchar(255) NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_SiteAssociatedMasons" (
	"A" uuid NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_SiteAssociatedUsers" (
	"A" uuid NOT NULL,
	"B" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "_DealerAssociatedMasons" ADD CONSTRAINT "_DealerAssociatedMasons_A_dealers_id_fk" FOREIGN KEY ("A") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_DealerAssociatedMasons" ADD CONSTRAINT "_DealerAssociatedMasons_B_mason_pc_side_id_fk" FOREIGN KEY ("B") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedDealers" ADD CONSTRAINT "_SiteAssociatedDealers_A_dealers_id_fk" FOREIGN KEY ("A") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedDealers" ADD CONSTRAINT "_SiteAssociatedDealers_B_technical_sites_id_fk" FOREIGN KEY ("B") REFERENCES "public"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedMasons" ADD CONSTRAINT "_SiteAssociatedMasons_A_mason_pc_side_id_fk" FOREIGN KEY ("A") REFERENCES "public"."mason_pc_side"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedMasons" ADD CONSTRAINT "_SiteAssociatedMasons_B_technical_sites_id_fk" FOREIGN KEY ("B") REFERENCES "public"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedUsers" ADD CONSTRAINT "_SiteAssociatedUsers_A_technical_sites_id_fk" FOREIGN KEY ("A") REFERENCES "public"."technical_sites"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SiteAssociatedUsers" ADD CONSTRAINT "_SiteAssociatedUsers_B_users_id_fk" FOREIGN KEY ("B") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "_DealerAssociatedMasons_AB_unique" ON "_DealerAssociatedMasons" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_DealerAssociatedMasons_B_index" ON "_DealerAssociatedMasons" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedDealers_AB_unique" ON "_SiteAssociatedDealers" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_SiteAssociatedDealers_B_index" ON "_SiteAssociatedDealers" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedMasons_AB_unique" ON "_SiteAssociatedMasons" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_SiteAssociatedMasons_B_index" ON "_SiteAssociatedMasons" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "_SiteAssociatedUsers_AB_unique" ON "_SiteAssociatedUsers" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_SiteAssociatedUsers_B_index" ON "_SiteAssociatedUsers" USING btree ("B");