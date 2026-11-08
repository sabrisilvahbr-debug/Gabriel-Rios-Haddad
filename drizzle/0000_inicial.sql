CREATE TYPE "public"."business_status" AS ENUM('nova', 'previa_pronta', 'na_fila', 'contatada', 'respondeu', 'interessada', 'cliente', 'descartada', 'nao_contatar', 'sem_whatsapp');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('nenhum', 'pendente', 'ativo', 'erro');--> statement-breakpoint
CREATE TYPE "public"."generation_source" AS ENUM('ia', 'padrao');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('out', 'in');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('primeiro_contato', 'follow_up', 'ia', 'manual', 'sistema', 'recebida', 'auto_resposta');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('agendada', 'enviada', 'erro', 'cancelada', 'recebida');--> statement-breakpoint
CREATE TYPE "public"."niche" AS ENUM('alimentacao', 'beleza', 'saude', 'automotivo', 'pet', 'casa', 'fitness', 'varejo', 'geral');--> statement-breakpoint
CREATE TYPE "public"."search_status" AS ENUM('running', 'succeeded', 'imported', 'failed');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('gerando', 'previa', 'publicado');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_status" AS ENUM('unknown', 'yes', 'no');--> statement-breakpoint
CREATE TABLE "app_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"tick_locked_until" timestamp with time zone,
	"wa_connection_state" text DEFAULT 'unknown' NOT NULL,
	"wa_last_qr" text,
	"wa_last_qr_at" timestamp with time zone,
	"sent_day" text DEFAULT '' NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"next_send_after" timestamp with time zone,
	"last_domain_check_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_phones" (
	"phone_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid,
	"place_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"niche" "niche" DEFAULT 'geral' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"neighborhood" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"phone_display" text NOT NULL,
	"phone_e164" text NOT NULL,
	"phone_is_mobile" boolean NOT NULL,
	"wa_jid" text,
	"whatsapp_status" "whatsapp_status" DEFAULT 'unknown' NOT NULL,
	"rating" double precision,
	"reviews_count" integer,
	"maps_url" text DEFAULT '' NOT NULL,
	"opening_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "business_status" DEFAULT 'nova' NOT NULL,
	"ai_paused" boolean DEFAULT false NOT NULL,
	"ai_reply_count" integer DEFAULT 0 NOT NULL,
	"last_outbound_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_place_id_unique" UNIQUE("place_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"business_id" uuid,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"kind" "message_kind" NOT NULL,
	"body" text NOT NULL,
	"wa_message_id" text,
	"status" "message_status" NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"location" text NOT NULL,
	"max_results" integer NOT NULL,
	"status" "search_status" DEFAULT 'running' NOT NULL,
	"apify_run_id" text,
	"apify_dataset_id" text,
	"found_count" integer DEFAULT 0 NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"agency_name" text DEFAULT '' NOT NULL,
	"agency_whatsapp" text DEFAULT '' NOT NULL,
	"include_landlines" boolean DEFAULT false NOT NULL,
	"default_max_results" integer DEFAULT 30 NOT NULL,
	"outreach_enabled" boolean DEFAULT false NOT NULL,
	"daily_limit" integer DEFAULT 20 NOT NULL,
	"window_days" text DEFAULT '1,2,3,4,5,6' NOT NULL,
	"window_start_hour" integer DEFAULT 9 NOT NULL,
	"window_end_hour" integer DEFAULT 18 NOT NULL,
	"min_interval_min" integer DEFAULT 4 NOT NULL,
	"max_interval_min" integer DEFAULT 12 NOT NULL,
	"message_templates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"follow_up_enabled" boolean DEFAULT false NOT NULL,
	"follow_up_after_days" integer DEFAULT 3 NOT NULL,
	"follow_up_template" text DEFAULT '' NOT NULL,
	"ai_replies_enabled" boolean DEFAULT false NOT NULL,
	"ai_max_replies" integer DEFAULT 8 NOT NULL,
	"offer_text" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"niche" "niche" NOT NULL,
	"content" jsonb NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "site_status" DEFAULT 'gerando' NOT NULL,
	"custom_domain" text,
	"domain_status" "domain_status" DEFAULT 'nenhum' NOT NULL,
	"domain_error" text,
	"generation_source" "generation_source" DEFAULT 'padrao' NOT NULL,
	"generated_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_business_id_unique" UNIQUE("business_id"),
	CONSTRAINT "sites_slug_unique" UNIQUE("slug"),
	CONSTRAINT "sites_custom_domain_unique" UNIQUE("custom_domain")
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "businesses_phone_idx" ON "businesses" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_wa_id_idx" ON "messages" USING btree ("wa_message_id") WHERE "messages"."wa_message_id" is not null;--> statement-breakpoint
CREATE INDEX "messages_business_idx" ON "messages" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_queue_idx" ON "messages" USING btree ("direction","status","created_at");