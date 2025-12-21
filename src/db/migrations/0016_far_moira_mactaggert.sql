CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"reference_id" varchar(255),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mason_pc_side" ADD COLUMN "device_id" varchar(255);--> statement-breakpoint
ALTER TABLE "mason_pc_side" ADD COLUMN "fcm_token" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fcm_token" varchar(500);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_user_id");--> statement-breakpoint
ALTER TABLE "mason_pc_side" ADD CONSTRAINT "mason_pc_side_device_id_unique" UNIQUE("device_id");