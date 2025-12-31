CREATE TABLE "_SchemeToRewards" (
	"A" integer NOT NULL,
	"B" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "technical_visit_reports" ADD COLUMN "journey_id" varchar(255);--> statement-breakpoint
ALTER TABLE "_SchemeToRewards" ADD CONSTRAINT "_SchemeToRewards_A_rewards_id_fk" FOREIGN KEY ("A") REFERENCES "public"."rewards"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_SchemeToRewards" ADD CONSTRAINT "_SchemeToRewards_B_schemes_offers_id_fk" FOREIGN KEY ("B") REFERENCES "public"."schemes_offers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "_SchemeToRewards_AB_unique" ON "_SchemeToRewards" USING btree ("A","B");--> statement-breakpoint
CREATE INDEX "_SchemeToRewards_B_index" ON "_SchemeToRewards" USING btree ("B");--> statement-breakpoint
CREATE INDEX "idx_tvr_journey_id" ON "technical_visit_reports" USING btree ("journey_id");