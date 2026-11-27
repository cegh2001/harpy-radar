CREATE TABLE "daily_anomaly_digests" (
	"id" serial PRIMARY KEY NOT NULL,
	"digest_date" text NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"highlights_json" jsonb NOT NULL,
	"flagged_products_count" integer DEFAULT 0 NOT NULL,
	"outlier_offers_count" integer DEFAULT 0 NOT NULL,
	"model_used" text NOT NULL,
	"prompt_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sku_arbitration_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_slug" text NOT NULL,
	"normalized_title_hash" text NOT NULL,
	"sample_raw_title" text NOT NULL,
	"is_valid_match" boolean NOT NULL,
	"tier" text NOT NULL,
	"effective_package_multiplier" numeric(8, 4) DEFAULT '1.0000' NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"reason" text NOT NULL,
	"model_used" text NOT NULL,
	"prompt_tokens" integer,
	"output_tokens" integer,
	"arbitrated_date" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_anomaly_digests_date_uidx" ON "daily_anomaly_digests" USING btree ("digest_date");--> statement-breakpoint
CREATE UNIQUE INDEX "sku_arb_cache_slug_hash_uidx" ON "sku_arbitration_cache" USING btree ("canonical_slug","normalized_title_hash");--> statement-breakpoint
CREATE INDEX "sku_arb_cache_date_idx" ON "sku_arbitration_cache" USING btree ("arbitrated_date");--> statement-breakpoint
CREATE INDEX "sku_arb_cache_expires_idx" ON "sku_arbitration_cache" USING btree ("expires_at");