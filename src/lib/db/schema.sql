-- Schéma PostgreSQL (Supabase, Neon, ou tout Postgres) pour COOB Optique.
-- Appliquer une fois : psql "$DATABASE_URL" -f src/lib/db/schema.sql

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
