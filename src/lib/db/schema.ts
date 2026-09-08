/**
 * Schémas SQL, appliqués automatiquement au premier accès (instructions idempotentes).
 * PostgreSQL : Supabase, Neon (Vercel Storage)… — SQLite : Cloudflare D1.
 */

export const PG_SCHEMA = `
create table if not exists appointments (
  id text primary key,
  code text not null unique,
  name text not null,
  phone text not null,
  agency text not null default 'koulouba',
  date date not null,
  time text not null,
  reason text not null default '',
  notes text not null default '',
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  confirmation_sms_at timestamptz,
  reminder_sms_at timestamptz
);
create index if not exists appointments_date_idx on appointments (agency, date, time);

create table if not exists orders (
  id text primary key,
  code text not null unique,
  customer_name text not null,
  phone text not null,
  agency text not null default 'koulouba',
  frame text not null default '',
  lenses text not null default '',
  notes text not null default '',
  total_fcfa integer,
  paid_fcfa integer,
  status text not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  collected_at timestamptz,
  ready_sms_at timestamptz
);
create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists orders_phone_idx on orders (phone);

create table if not exists sms_log (
  id text primary key,
  "to" text not null,
  body text not null,
  provider text not null,
  status text not null,
  provider_id text,
  error text,
  related_type text,
  related_id text,
  created_at timestamptz not null default now()
);
create index if not exists sms_log_created_idx on sms_log (created_at desc);

create table if not exists frames (
  id text primary key,
  slug text not null unique,
  name text not null,
  collection text not null default '',
  shape text not null default 'rectangle',
  material text not null default 'acetate',
  color text not null default 'noir',
  gender text not null default 'mixte',
  price_fcfa integer not null default 0,
  size_lens integer not null default 0,
  size_bridge integer not null default 0,
  size_temple integer not null default 0,
  description text not null default '',
  tags text not null default '',
  image bytea,
  image_mime text,
  image_width integer not null default 0,
  image_height integer not null default 0,
  anchor_lx real not null default 0,
  anchor_ly real not null default 0,
  anchor_rx real not null default 0,
  anchor_ry real not null default 0,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists frames_active_idx on frames (active, sort_order, created_at);

create table if not exists frame_models (
  frame_id text primary key references frames(id) on delete cascade,
  mime text not null,
  model bytea not null,
  updated_at timestamptz not null default now()
);
`;

export const SQLITE_SCHEMA = `
create table if not exists appointments (
  id text primary key,
  code text not null unique,
  name text not null,
  phone text not null,
  agency text not null default 'koulouba',
  date text not null,
  time text not null,
  reason text not null default '',
  notes text not null default '',
  status text not null default 'confirmed',
  created_at text not null,
  confirmation_sms_at text,
  reminder_sms_at text
);
create index if not exists appointments_date_idx on appointments (agency, date, time);

create table if not exists orders (
  id text primary key,
  code text not null unique,
  customer_name text not null,
  phone text not null,
  agency text not null default 'koulouba',
  frame text not null default '',
  lenses text not null default '',
  notes text not null default '',
  total_fcfa integer,
  paid_fcfa integer,
  status text not null default 'received',
  created_at text not null,
  updated_at text not null,
  ready_at text,
  collected_at text,
  ready_sms_at text
);
create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists orders_phone_idx on orders (phone);

create table if not exists sms_log (
  id text primary key,
  "to" text not null,
  body text not null,
  provider text not null,
  status text not null,
  provider_id text,
  error text,
  related_type text,
  related_id text,
  created_at text not null
);
create index if not exists sms_log_created_idx on sms_log (created_at desc);

create table if not exists frames (
  id text primary key,
  slug text not null unique,
  name text not null,
  collection text not null default '',
  shape text not null default 'rectangle',
  material text not null default 'acetate',
  color text not null default 'noir',
  gender text not null default 'mixte',
  price_fcfa integer not null default 0,
  size_lens integer not null default 0,
  size_bridge integer not null default 0,
  size_temple integer not null default 0,
  description text not null default '',
  tags text not null default '',
  image blob,
  image_mime text,
  image_width integer not null default 0,
  image_height integer not null default 0,
  anchor_lx real not null default 0,
  anchor_ly real not null default 0,
  anchor_rx real not null default 0,
  anchor_ry real not null default 0,
  active integer not null default 1,
  sort_order integer not null default 0,
  created_at text not null,
  updated_at text not null
);
create index if not exists frames_active_idx on frames (active, sort_order, created_at);

create table if not exists frame_models (
  frame_id text primary key references frames(id) on delete cascade,
  mime text not null,
  model blob not null,
  updated_at text not null
);
`;

/** Migrations additives (exécutées une par une ; une colonne déjà présente est ignorée). */
export const PG_MIGRATIONS = [
  `alter table frame_models add column if not exists rotation text not null default '0,0,0'`,
  `alter table frame_models add column if not exists use_in_tryon boolean not null default false`,
];
export const SQLITE_MIGRATIONS = [
  `alter table frame_models add column rotation text not null default '0,0,0'`,
  `alter table frame_models add column use_in_tryon integer not null default 0`,
];

/** Découpe un script en instructions (pour les moteurs sans exécution multi-instructions). */
export function splitStatements(script: string): string[] {
  return script
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
