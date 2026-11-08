import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  BUSINESS_STATUSES,
  DOMAIN_STATUSES,
  GENERATION_SOURCES,
  MESSAGE_DIRECTIONS,
  MESSAGE_KINDS,
  MESSAGE_STATUSES,
  NICHES,
  SEARCH_STATUSES,
  SITE_STATUSES,
  WHATSAPP_STATUSES,
} from '../constants';
import type { OpeningHour, SiteContent, SitePhoto } from '../types';

export const searchStatusEnum = pgEnum('search_status', SEARCH_STATUSES);
export const businessStatusEnum = pgEnum('business_status', BUSINESS_STATUSES);
export const whatsappStatusEnum = pgEnum('whatsapp_status', WHATSAPP_STATUSES);
export const nicheEnum = pgEnum('niche', NICHES);
export const siteStatusEnum = pgEnum('site_status', SITE_STATUSES);
export const domainStatusEnum = pgEnum('domain_status', DOMAIN_STATUSES);
export const generationSourceEnum = pgEnum('generation_source', GENERATION_SOURCES);
export const messageDirectionEnum = pgEnum('message_direction', MESSAGE_DIRECTIONS);
export const messageKindEnum = pgEnum('message_kind', MESSAGE_KINDS);
export const messageStatusEnum = pgEnum('message_status', MESSAGE_STATUSES);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  agencyName: text('agency_name').notNull().default(''),
  agencyWhatsapp: text('agency_whatsapp').notNull().default(''),
  includeLandlines: boolean('include_landlines').notNull().default(false),
  defaultMaxResults: integer('default_max_results').notNull().default(30),
  outreachEnabled: boolean('outreach_enabled').notNull().default(false),
  dailyLimit: integer('daily_limit').notNull().default(20),
  windowDays: text('window_days').notNull().default('1,2,3,4,5,6'),
  windowStartHour: integer('window_start_hour').notNull().default(9),
  windowEndHour: integer('window_end_hour').notNull().default(18),
  minIntervalMin: integer('min_interval_min').notNull().default(4),
  maxIntervalMin: integer('max_interval_min').notNull().default(12),
  messageTemplates: jsonb('message_templates').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  followUpEnabled: boolean('follow_up_enabled').notNull().default(false),
  followUpAfterDays: integer('follow_up_after_days').notNull().default(3),
  followUpTemplate: text('follow_up_template').notNull().default(''),
  aiRepliesEnabled: boolean('ai_replies_enabled').notNull().default(false),
  aiMaxReplies: integer('ai_max_replies').notNull().default(8),
  offerText: text('offer_text').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const searches = pgTable('searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  term: text('term').notNull(),
  location: text('location').notNull(),
  maxResults: integer('max_results').notNull(),
  status: searchStatusEnum('status').notNull().default('running'),
  apifyRunId: text('apify_run_id'),
  apifyDatasetId: text('apify_dataset_id'),
  foundCount: integer('found_count').notNull().default(0),
  importedCount: integer('imported_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    searchId: uuid('search_id').references(() => searches.id, { onDelete: 'set null' }),
    placeId: text('place_id').notNull().unique(),
    name: text('name').notNull(),
    category: text('category').notNull().default(''),
    niche: nicheEnum('niche').notNull().default('geral'),
    address: text('address').notNull().default(''),
    neighborhood: text('neighborhood').notNull().default(''),
    city: text('city').notNull().default(''),
    state: text('state').notNull().default(''),
    phoneDisplay: text('phone_display').notNull(),
    phoneE164: text('phone_e164').notNull(),
    phoneIsMobile: boolean('phone_is_mobile').notNull(),
    waJid: text('wa_jid'),
    whatsappStatus: whatsappStatusEnum('whatsapp_status').notNull().default('unknown'),
    rating: doublePrecision('rating'),
    reviewsCount: integer('reviews_count'),
    mapsUrl: text('maps_url').notNull().default(''),
    openingHours: jsonb('opening_hours').$type<OpeningHour[]>().notNull().default(sql`'[]'::jsonb`),
    imageUrls: jsonb('image_urls').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    description: text('description').notNull().default(''),
    status: businessStatusEnum('status').notNull().default('nova'),
    aiPaused: boolean('ai_paused').notNull().default(false),
    aiReplyCount: integer('ai_reply_count').notNull().default(0),
    lastOutboundAt: timestamp('last_outbound_at', { withTimezone: true }),
    lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (t) => [index('businesses_phone_idx').on(t.phoneE164), index('businesses_status_idx').on(t.status)],
);

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .unique()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  niche: nicheEnum('niche').notNull(),
  content: jsonb('content').$type<SiteContent>().notNull(),
  photos: jsonb('photos').$type<SitePhoto[]>().notNull().default(sql`'[]'::jsonb`),
  status: siteStatusEnum('status').notNull().default('gerando'),
  customDomain: text('custom_domain').unique(),
  domainStatus: domainStatusEnum('domain_status').notNull().default('nenhum'),
  domainError: text('domain_error'),
  generationSource: generationSourceEnum('generation_source').notNull().default('padrao'),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  ...timestamps,
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    direction: messageDirectionEnum('direction').notNull(),
    kind: messageKindEnum('kind').notNull(),
    body: text('body').notNull(),
    waMessageId: text('wa_message_id'),
    status: messageStatusEnum('status').notNull(),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('messages_wa_id_idx')
      .on(t.waMessageId)
      .where(sql`${t.waMessageId} is not null`),
    index('messages_business_idx').on(t.businessId, t.createdAt),
    index('messages_queue_idx').on(t.direction, t.status, t.createdAt),
  ],
);

export const appState = pgTable('app_state', {
  id: integer('id').primaryKey().default(1),
  tickLockedUntil: timestamp('tick_locked_until', { withTimezone: true }),
  waConnectionState: text('wa_connection_state').notNull().default('unknown'),
  waLastQr: text('wa_last_qr'),
  waLastQrAt: timestamp('wa_last_qr_at', { withTimezone: true }),
  sentDay: text('sent_day').notNull().default(''),
  sentCount: integer('sent_count').notNull().default(0),
  nextSendAfter: timestamp('next_send_after', { withTimezone: true }),
  lastDomainCheckAt: timestamp('last_domain_check_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const blockedPhones = pgTable('blocked_phones', {
  phoneHash: text('phone_hash').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('events_created_idx').on(t.createdAt)],
);

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type Search = typeof searches.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type AppState = typeof appState.$inferSelect;
export type NewAppState = typeof appState.$inferInsert;
export type AppEvent = typeof events.$inferSelect;
