-- =============================================================
-- Visual Placemat — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- 1. Capability catalogs (one per uploaded file)
create table if not exists capability_catalogs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                          -- e.g. "SPM Capability Model"
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Capabilities (hierarchical L0→L1→L2→L3)
create table if not exists capabilities (
  id            uuid primary key default gen_random_uuid(),
  catalog_id    uuid not null references capability_catalogs(id) on delete cascade,
  parent_id     uuid references capabilities(id) on delete cascade,  -- null = root (L0)
  level         smallint not null check (level between 0 and 3),     -- 0, 1, 2, or 3
  name          text not null,
  description   text,
  sort_order    integer not null default 0,              -- preserve original row order
  created_at    timestamptz not null default now()
);

-- Index for fast tree queries
create index if not exists idx_capabilities_parent   on capabilities(parent_id);
create index if not exists idx_capabilities_catalog  on capabilities(catalog_id);
create index if not exists idx_capabilities_level    on capabilities(catalog_id, level);

-- 3. Visual maps generated from a catalog
create table if not exists visual_maps (
  id            uuid primary key default gen_random_uuid(),
  catalog_id    uuid not null references capability_catalogs(id) on delete cascade,
  name          text not null,                           -- e.g. "SPM Capability Map v1"
  layout_data   jsonb,                                   -- React Flow node/edge positions
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 4. Row-Level Security (RLS)
alter table capability_catalogs enable row level security;
alter table capabilities        enable row level security;
alter table visual_maps         enable row level security;

-- Allow authenticated users full access to their own data
-- (Adjust policies once you add a user_id column for multi-tenancy)
create policy "Allow all for authenticated" on capability_catalogs
  for all using (auth.role() = 'authenticated');

create policy "Allow all for authenticated" on capabilities
  for all using (auth.role() = 'authenticated');

create policy "Allow all for authenticated" on visual_maps
  for all using (auth.role() = 'authenticated');
