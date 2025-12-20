ALTER TABLE "users" ADD COLUMN "device_id" varchar(255);--> statement-breakpoint
CREATE INDEX "idx_user_device_id" ON "users" USING btree ("device_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_device_id_unique" UNIQUE("device_id");