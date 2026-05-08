ALTER TABLE "bestcement"."sales_reports" ALTER COLUMN "current_month_mtd_sales" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ALTER COLUMN "current_month_target" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ALTER COLUMN "balance" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ALTER COLUMN "prorata_sales_target" SET DATA TYPE numeric(10, 2);