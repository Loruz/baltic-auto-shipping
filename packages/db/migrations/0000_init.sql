CREATE TYPE "public"."actor_type" AS ENUM('customer', 'operator', 'admin', 'system', 'stripe');--> statement-breakpoint
CREATE TYPE "public"."auction_source" AS ENUM('copart', 'iaai');--> statement-breakpoint
CREATE TYPE "public"."bid_payment_status" AS ENUM('not_required', 'pending', 'paid', 'overdue', 'forfeited');--> statement-breakpoint
CREATE TYPE "public"."bid_status" AS ENUM('pending', 'locked', 'placed', 'won_pending_approval', 'won', 'lost', 'not_placed', 'cancelled', 'outbid');--> statement-breakpoint
CREATE TYPE "public"."buying_power_entry_kind" AS ENUM('grant', 'revoke', 'reserve', 'release', 'consume', 'restore', 'adjust_up', 'adjust_down');--> statement-breakpoint
CREATE TYPE "public"."customer_type" AS ENUM('individual', 'company');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('pending', 'succeeded', 'failed', 'canceled', 'closed');--> statement-breakpoint
CREATE TYPE "public"."deposit_tx_kind" AS ENUM('payment', 'refund', 'forfeit', 'apply_to_purchase', 'dispute_opened', 'dispute_won', 'dispute_lost');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('green', 'red', 'black', 'double_red', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."kyc_provider" AS ENUM('ondato', 'veriff');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('created', 'pending', 'approved', 'declined', 'resubmission_requested', 'expired', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."lot_status" AS ENUM('upcoming', 'live', 'sold', 'on_approval', 'not_sold', 'removed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."odometer_brand" AS ENUM('actual', 'exempt', 'not_actual', 'exceeds_mechanical', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."port_kind" AS ENUM('us_export', 'eu_import');--> statement-breakpoint
CREATE TYPE "public"."rate_card_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sale_outcome" AS ENUM('sold', 'on_approval', 'not_sold', 'cancelled', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."shipping_method" AS ENUM('container', 'roro');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tx_origin" AS ENUM('platform', 'stripe_dashboard', 'system');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('car', 'motorcycle', 'truck', 'atv', 'other');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_fee_bands" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auction_fee_bands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"rate_card_id" bigint NOT NULL,
	"source" "auction_source" NOT NULL,
	"fee_code" text NOT NULL,
	"price_from_cents" bigint NOT NULL,
	"price_to_cents" bigint,
	"flat_usd_cents" bigint,
	"percent" numeric(6, 3),
	CONSTRAINT "fee_bands_value_chk" CHECK ("auction_fee_bands"."flat_usd_cents" is not null or "auction_fee_bands"."percent" is not null)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bid_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"bid_id" bigint NOT NULL,
	"from_status" "bid_status",
	"to_status" "bid_status" NOT NULL,
	"from_amount_usd_cents" bigint,
	"to_amount_usd_cents" bigint,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bids_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"lot_id" bigint NOT NULL,
	"max_bid_usd_cents" bigint NOT NULL,
	"is_buy_now" boolean DEFAULT false NOT NULL,
	"status" "bid_status" DEFAULT 'pending' NOT NULL,
	"sale_at_when_placed" timestamp with time zone,
	"cutoff_at" timestamp with time zone,
	"lot_snapshot" jsonb NOT NULL,
	"quote_id" bigint,
	"plan_version_id" bigint,
	"terms_version" text NOT NULL,
	"placed_by" text,
	"placed_at" timestamp with time zone,
	"final_price_usd_cents" bigint,
	"result_at" timestamp with time zone,
	"result_set_by" text,
	"payment_status" "bid_payment_status" DEFAULT 'not_required' NOT NULL,
	"payment_due_at" timestamp with time zone,
	"paid_marked_at" timestamp with time zone,
	"outbid_by_bid_id" bigint,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bids_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "bids_amount_chk" CHECK ("bids"."max_bid_usd_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "buying_power_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"granted_usd_cents" bigint DEFAULT 0 NOT NULL,
	"reserved_usd_cents" bigint DEFAULT 0 NOT NULL,
	"consumed_usd_cents" bigint DEFAULT 0 NOT NULL,
	"plan_version_id" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bp_accounts_nonneg_chk" CHECK ("buying_power_accounts"."granted_usd_cents" >= 0 and "buying_power_accounts"."reserved_usd_cents" >= 0 and "buying_power_accounts"."consumed_usd_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "buying_power_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "buying_power_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"kind" "buying_power_entry_kind" NOT NULL,
	"amount_usd_cents" bigint NOT NULL,
	"deposit_id" bigint,
	"bid_id" bigint,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text,
	"reason" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buying_power_entries_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "bp_entries_amount_chk" CHECK ("buying_power_entries"."amount_usd_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"type" "customer_type" DEFAULT 'individual' NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"company_code" text,
	"vat_number" text,
	"vat_verified_at" timestamp with time zone,
	"country" char(2),
	"city" text,
	"address" text,
	"phone" text,
	"phone_verified_at" timestamp with time zone,
	"locale" text DEFAULT 'lt' NOT NULL,
	"stripe_customer_id" text,
	"kyc_approved_at" timestamp with time zone,
	"bidding_blocked_at" timestamp with time zone,
	"bidding_blocked_reason" text,
	"broker_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_profiles_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "deposit_transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deposit_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"deposit_id" bigint NOT NULL,
	"kind" "deposit_tx_kind" NOT NULL,
	"origin" "tx_origin" NOT NULL,
	"amount_eur_cents" bigint NOT NULL,
	"stripe_object_id" text,
	"bid_id" bigint,
	"idempotency_key" text,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_transactions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "deposit_tx_amount_chk" CHECK ("deposit_transactions"."amount_eur_cents" > 0),
	CONSTRAINT "deposit_tx_dedupe_chk" CHECK ("deposit_transactions"."stripe_object_id" is not null or "deposit_transactions"."idempotency_key" is not null)
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deposits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"plan_version_id" bigint NOT NULL,
	"upgrades_deposit_id" bigint,
	"amount_eur_cents" bigint NOT NULL,
	"grants_buying_power_usd_cents" bigint NOT NULL,
	"status" "deposit_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "payment_method",
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"succeeded_at" timestamp with time zone,
	"refund_requested_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposits_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "deposits_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "deposits_amount_chk" CHECK ("deposits"."amount_eur_cents" > 0 and "deposits"."grants_buying_power_usd_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"lot_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_lot_id_pk" PRIMARY KEY("user_id","lot_id")
);
--> statement-breakpoint
CREATE TABLE "fixed_fees" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fixed_fees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"rate_card_id" bigint NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"currency" char(3) NOT NULL,
	"amount_cents" bigint,
	"percent" numeric(6, 3),
	"vat_rate" numeric(5, 2),
	"vehicle_type" "vehicle_type",
	"is_optional" boolean DEFAULT false NOT NULL,
	"in_vat_base" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"rate_date" date NOT NULL,
	"base" char(3) NOT NULL,
	"quote" char(3) NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_rate_date_base_quote_pk" PRIMARY KEY("rate_date","base","quote")
);
--> statement-breakpoint
CREATE TABLE "kyc_checks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "kyc_checks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"provider" "kyc_provider" NOT NULL,
	"provider_session_id" text NOT NULL,
	"status" "kyc_status" DEFAULT 'created' NOT NULL,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lot_raw" (
	"lot_id" bigint PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lot_sales" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lot_sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lot_id" bigint NOT NULL,
	"sale_at" timestamp with time zone NOT NULL,
	"outcome" "sale_outcome" NOT NULL,
	"final_bid_usd_cents" bigint,
	"odometer_at_sale" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" "auction_source" NOT NULL,
	"external_lot_id" text NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"yard_id" bigint,
	"status" "lot_status" DEFAULT 'upcoming' NOT NULL,
	"sale_at" timestamp with time zone,
	"odometer" integer,
	"odometer_unit" text DEFAULT 'mi' NOT NULL,
	"odometer_brand" "odometer_brand" DEFAULT 'unknown' NOT NULL,
	"primary_damage" text,
	"secondary_damage" text,
	"has_keys" boolean,
	"run_condition" text,
	"title_type" text,
	"title_state" char(2),
	"sale_document" text,
	"export_status" "export_status" DEFAULT 'unknown' NOT NULL,
	"seller_type" text,
	"seller_name" text,
	"current_bid_usd_cents" bigint,
	"buy_now_usd_cents" bigint,
	"est_retail_usd_cents" bigint,
	"on_approval" boolean,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"has_video_360" boolean DEFAULT false NOT NULL,
	"export_status_override" "export_status",
	"source_updated_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"channel" "notification_channel" NOT NULL,
	"recipient" text NOT NULL,
	"user_id" text,
	"template" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"bid_id" bigint,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ocean_rates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ocean_rates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"rate_card_id" bigint NOT NULL,
	"from_port_id" bigint NOT NULL,
	"to_port_id" bigint NOT NULL,
	"vehicle_type" "vehicle_type" DEFAULT 'car' NOT NULL,
	"method" "shipping_method" DEFAULT 'container' NOT NULL,
	"price_usd_cents" bigint NOT NULL,
	"transit_days_min" integer,
	"transit_days_max" integer
);
--> statement-breakpoint
CREATE TABLE "plan_versions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "plan_versions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"plan_id" bigint NOT NULL,
	"version" integer NOT NULL,
	"deposit_eur_cents" bigint NOT NULL,
	"buying_power_usd_cents" bigint NOT NULL,
	"max_active_bids" integer NOT NULL,
	"max_bid_per_lot_usd_cents" bigint,
	"stripe_price_id" text,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_versions_amounts_chk" CHECK ("plan_versions"."deposit_eur_cents" > 0 and "plan_versions"."buying_power_usd_cents" > 0 and "plan_versions"."max_active_bids" > 0)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_user_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "ports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"name" text NOT NULL,
	"country" char(2) NOT NULL,
	"kind" "port_kind" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "ports_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quotes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lot_id" bigint,
	"user_id" text,
	"bid_usd_cents" bigint NOT NULL,
	"rate_card_id" bigint NOT NULL,
	"fx_rate_date" date NOT NULL,
	"fx_rate" numeric(14, 6) NOT NULL,
	"inputs" jsonb NOT NULL,
	"lines" jsonb NOT NULL,
	"total_eur_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_cards" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rate_cards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"status" "rate_card_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"published_at" timestamp with time zone,
	"published_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saved_searches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"feed" text NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"cursor_from" text,
	"cursor_to" text,
	"lots_upserted" integer DEFAULT 0 NOT NULL,
	"lots_removed" integer DEFAULT 0 NOT NULL,
	"requests_used" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tax_rates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"rate_card_id" bigint NOT NULL,
	"code" text NOT NULL,
	"rate_percent" numeric(6, 3) NOT NULL,
	"basis" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "towing_rates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "towing_rates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"rate_card_id" bigint NOT NULL,
	"yard_id" bigint,
	"state" char(2),
	"port_id" bigint NOT NULL,
	"vehicle_type" "vehicle_type" DEFAULT 'car' NOT NULL,
	"price_usd_cents" bigint NOT NULL,
	CONSTRAINT "towing_target_chk" CHECK ("towing_rates"."yard_id" is not null or "towing_rates"."state" is not null)
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_chk" CHECK ("user"."role" in ('customer','operator','admin'))
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vin" text,
	"year" integer,
	"make" text,
	"model" text,
	"trim" text,
	"body_style" text,
	"vehicle_type" "vehicle_type" DEFAULT 'car' NOT NULL,
	"engine" text,
	"cylinders" integer,
	"fuel" text,
	"drive" text,
	"transmission" text,
	"color" text,
	"vin_decode" jsonb,
	"vin_decoded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yards" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "yards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" "auction_source" NOT NULL,
	"external_code" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"state" char(2),
	"zip" text,
	"country" char(2) DEFAULT 'US' NOT NULL,
	"timezone" text,
	"lat" numeric(9, 6),
	"lon" numeric(9, 6)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_fee_bands" ADD CONSTRAINT "auction_fee_bands_rate_card_id_rate_cards_id_fk" FOREIGN KEY ("rate_card_id") REFERENCES "public"."rate_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_events" ADD CONSTRAINT "bid_events_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_placed_by_user_id_fk" FOREIGN KEY ("placed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_result_set_by_user_id_fk" FOREIGN KEY ("result_set_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_outbid_by_bid_id_bids_id_fk" FOREIGN KEY ("outbid_by_bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buying_power_accounts" ADD CONSTRAINT "buying_power_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buying_power_accounts" ADD CONSTRAINT "buying_power_accounts_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buying_power_entries" ADD CONSTRAINT "buying_power_entries_user_id_buying_power_accounts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."buying_power_accounts"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buying_power_entries" ADD CONSTRAINT "buying_power_entries_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buying_power_entries" ADD CONSTRAINT "buying_power_entries_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_plan_version_id_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_upgrades_deposit_id_deposits_id_fk" FOREIGN KEY ("upgrades_deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_fees" ADD CONSTRAINT "fixed_fees_rate_card_id_rate_cards_id_fk" FOREIGN KEY ("rate_card_id") REFERENCES "public"."rate_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_checks" ADD CONSTRAINT "kyc_checks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_raw" ADD CONSTRAINT "lot_raw_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_sales" ADD CONSTRAINT "lot_sales_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_yard_id_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocean_rates" ADD CONSTRAINT "ocean_rates_rate_card_id_rate_cards_id_fk" FOREIGN KEY ("rate_card_id") REFERENCES "public"."rate_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocean_rates" ADD CONSTRAINT "ocean_rates_from_port_id_ports_id_fk" FOREIGN KEY ("from_port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocean_rates" ADD CONSTRAINT "ocean_rates_to_port_id_ports_id_fk" FOREIGN KEY ("to_port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rate_card_id_rate_cards_id_fk" FOREIGN KEY ("rate_card_id") REFERENCES "public"."rate_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_rate_card_id_rate_cards_id_fk" FOREIGN KEY ("rate_card_id") REFERENCES "public"."rate_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "towing_rates" ADD CONSTRAINT "towing_rates_rate_card_id_rate_cards_id_fk" FOREIGN KEY ("rate_card_id") REFERENCES "public"."rate_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "towing_rates" ADD CONSTRAINT "towing_rates_yard_id_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "towing_rates" ADD CONSTRAINT "towing_rates_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fee_bands_lookup_idx" ON "auction_fee_bands" USING btree ("rate_card_id","source","fee_code","price_from_cents");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "bid_events_bid_idx" ON "bid_events" USING btree ("bid_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_one_active_per_lot_uq" ON "bids" USING btree ("lot_id") WHERE "bids"."status" in ('pending','locked','placed','won_pending_approval');--> statement-breakpoint
CREATE INDEX "bids_user_status_idx" ON "bids" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "bids_status_cutoff_idx" ON "bids" USING btree ("status","cutoff_at");--> statement-breakpoint
CREATE INDEX "bids_lot_idx" ON "bids" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "bp_entries_user_idx" ON "buying_power_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "deposit_tx_deposit_idx" ON "deposit_transactions" USING btree ("deposit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_tx_stripe_kind_uq" ON "deposit_transactions" USING btree ("stripe_object_id","kind") WHERE "deposit_transactions"."stripe_object_id" is not null;--> statement-breakpoint
CREATE INDEX "deposits_user_idx" ON "deposits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "favorites_lot_idx" ON "favorites" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_fees_uq" ON "fixed_fees" USING btree ("rate_card_id","code","vehicle_type");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_provider_session_uq" ON "kyc_checks" USING btree ("provider","provider_session_id");--> statement-breakpoint
CREATE INDEX "kyc_user_idx" ON "kyc_checks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lot_sales_lot_sale_uq" ON "lot_sales" USING btree ("lot_id","sale_at");--> statement-breakpoint
CREATE INDEX "lot_sales_sale_at_idx" ON "lot_sales" USING btree ("sale_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lots_source_external_uq" ON "lots" USING btree ("source","external_lot_id");--> statement-breakpoint
CREATE INDEX "lots_vehicle_idx" ON "lots" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "lots_status_sale_idx" ON "lots" USING btree ("status","sale_at");--> statement-breakpoint
CREATE INDEX "lots_synced_idx" ON "lots" USING btree ("synced_at");--> statement-breakpoint
CREATE INDEX "notifications_queue_idx" ON "notifications" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ocean_rates_uq" ON "ocean_rates" USING btree ("rate_card_id","from_port_id","to_port_id","vehicle_type","method");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_versions_plan_version_uq" ON "plan_versions" USING btree ("plan_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_cards_one_active_uq" ON "rate_cards" USING btree ("status") WHERE "rate_cards"."status" = 'active';--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stripe_events_unprocessed_idx" ON "stripe_events" USING btree ("received_at") WHERE "stripe_events"."processed_at" is null;--> statement-breakpoint
CREATE INDEX "sync_runs_feed_started_idx" ON "sync_runs" USING btree ("provider","feed","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_rates_uq" ON "tax_rates" USING btree ("rate_card_id","code");--> statement-breakpoint
CREATE INDEX "towing_lookup_idx" ON "towing_rates" USING btree ("rate_card_id","yard_id","state");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_vin_uq" ON "vehicles" USING btree ("vin") WHERE "vehicles"."vin" is not null;--> statement-breakpoint
CREATE INDEX "vehicles_make_model_idx" ON "vehicles" USING btree ("make","model","year");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "yards_source_code_uq" ON "yards" USING btree ("source","external_code");