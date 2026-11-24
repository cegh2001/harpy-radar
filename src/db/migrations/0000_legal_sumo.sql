CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"rate_date" text NOT NULL,
	"source" text NOT NULL,
	"usd_rate" numeric(14, 6) NOT NULL,
	"eur_rate" numeric(14, 6),
	"bcv_date_text" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"base_unit" text NOT NULL,
	"basket_monthly_qty" numeric(10, 3) NOT NULL,
	"search_terms" jsonb NOT NULL,
	"required_tokens" jsonb NOT NULL,
	"excluded_tokens" jsonb NOT NULL,
	"expected_min_unit_usd" numeric(10, 4) NOT NULL,
	"expected_max_unit_usd" numeric(10, 4) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "retailers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"adapter_key" text NOT NULL,
	"base_url" text NOT NULL,
	"default_currency" text NOT NULL,
	"primary_region" text NOT NULL,
	"status" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retailers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_product_id" integer NOT NULL,
	"retailer_id" integer NOT NULL,
	"exchange_rate_id" integer NOT NULL,
	"parallel_rate_id" integer,
	"external_sku" text NOT NULL,
	"barcode" text,
	"raw_title" text NOT NULL,
	"product_url" text,
	"image_url" text,
	"original_amount" numeric(14, 4) NOT NULL,
	"original_currency" text NOT NULL,
	"price_usd_bcv" numeric(14, 4) NOT NULL,
	"price_ves" numeric(14, 4) NOT NULL,
	"price_usd_parallel" numeric(14, 4),
	"package_size" numeric(12, 4) NOT NULL,
	"package_unit" text NOT NULL,
	"normalized_unit_price_usd" numeric(14, 4) NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"store_availability_count" integer,
	"match_confidence" numeric(4, 3) NOT NULL,
	"region" text NOT NULL,
	"content_hash" text NOT NULL,
	"observed_date" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benchmark_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"period_month" text NOT NULL,
	"basket_cost_usd" numeric(12, 2) NOT NULL,
	"basket_cost_ves" numeric(14, 2),
	"family_size" integer DEFAULT 5 NOT NULL,
	"notes" text,
	"source_url" text,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"retailer_slug" text,
	"status" text NOT NULL,
	"items_fetched" integer DEFAULT 0 NOT NULL,
	"items_matched" integer DEFAULT 0 NOT NULL,
	"items_saved" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"job_name" text PRIMARY KEY NOT NULL,
	"is_executing" boolean DEFAULT false NOT NULL,
	"last_heartbeat_at" timestamp with time zone NOT NULL,
	"last_cycle_at" timestamp with time zone,
	"last_cycle_status" text DEFAULT 'ready' NOT NULL,
	"last_error" text,
	"cycle_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_canonical_product_id_canonical_products_id_fk" FOREIGN KEY ("canonical_product_id") REFERENCES "public"."canonical_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_exchange_rate_id_exchange_rates_id_fk" FOREIGN KEY ("exchange_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_parallel_rate_id_exchange_rates_id_fk" FOREIGN KEY ("parallel_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchange_rates_source_fetched_idx" ON "exchange_rates" USING btree ("source","fetched_at");--> statement-breakpoint
CREATE INDEX "exchange_rates_date_source_idx" ON "exchange_rates" USING btree ("rate_date","source");--> statement-breakpoint
CREATE INDEX "price_obs_product_observed_idx" ON "price_observations" USING btree ("canonical_product_id","observed_at");--> statement-breakpoint
CREATE INDEX "price_obs_retailer_observed_idx" ON "price_observations" USING btree ("retailer_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "price_obs_daily_dedup_uidx" ON "price_observations" USING btree ("retailer_id","external_sku","observed_date","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "benchmark_source_month_uidx" ON "benchmark_snapshots" USING btree ("source","period_month");