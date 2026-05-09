ALTER TABLE "bestcement"."daily_visit_reports" ALTER COLUMN "latitude" SET DATA TYPE numeric(20, 7);--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ALTER COLUMN "longitude" SET DATA TYPE numeric(20, 7);--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ALTER COLUMN "dealer_total_potential" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ALTER COLUMN "dealer_best_potential" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ALTER COLUMN "today_order_mt" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ALTER COLUMN "today_collection_rupees" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ALTER COLUMN "overdue_amount" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."daily_visit_reports" ALTER COLUMN "current_dealer_outstanding_amt" SET DATA TYPE numeric(18, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "collection_target_lakhs" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "collection_achievement_lakhs" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "spend_target_lakhs" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "spend_achievement_lakhs" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "petty_cash_balance_lakhs" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "bills_pending_lakhs" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "ten_days_cash_req_cr" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "expected_inflow_sales_cr" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "cmd_payment_due_lakhs" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "cash_book_status_jud" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "cash_book_status_jsb" varchar(255);--> statement-breakpoint
ALTER TABLE "bestcement"."accounts_reports" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "bestcement"."hr_reports" ADD COLUMN "underperformers_plant" jsonb;--> statement-breakpoint
ALTER TABLE "bestcement"."hr_reports" ADD COLUMN "underperformers_ho" jsonb;--> statement-breakpoint
ALTER TABLE "bestcement"."hr_reports" ADD COLUMN "interview_candidates" jsonb;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" ADD COLUMN "dayofmonth" jsonb;--> statement-breakpoint
ALTER TABLE "bestcement"."sales_reports" DROP COLUMN "dayOfMonth";