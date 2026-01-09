CREATE TABLE "journey_ops" (
	"server_seq" bigserial PRIMARY KEY NOT NULL,
	"op_id" uuid NOT NULL,
	"journey_id" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_ops_op_id_unique" UNIQUE("op_id")
);
--> statement-breakpoint
ALTER TABLE "journey_ops" ADD CONSTRAINT "journey_ops_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "journey_ops" ADD CONSTRAINT "journey_ops_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_journey_ops_journey" ON "journey_ops" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_user" ON "journey_ops" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_journey_ops_created" ON "journey_ops" USING btree ("created_at");