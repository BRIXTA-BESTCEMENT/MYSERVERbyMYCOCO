CREATE TABLE "sync_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_server_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_journey_ops_server_seq" ON "journey_ops" USING btree ("server_seq");