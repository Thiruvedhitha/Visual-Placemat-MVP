-- =============================================================
-- Visual Placemat — Supabase Schema (MVP v2)
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- 1. Capability catalogs (one per uploaded file)
create table if not exists capability_catalogs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                          -- e.g. "SPM Capability Model"
  description   text,
  industry      text,                                   -- "Banking" | "Healthcare" | "Retail" — AI context
  status        text default 'active',                  -- "active" | "archived"
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
  source        text default 'xlsx_import',              -- "xlsx_import" | "ai_generated" | "manual"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes for fast tree queries
create index if not exists idx_capabilities_parent       on capabilities(parent_id);
create index if not exists idx_capabilities_catalog      on capabilities(catalog_id);
create index if not exists idx_capabilities_level        on capabilities(catalog_id, level);
create index if not exists idx_capabilities_catalog_sort on capabilities(catalog_id, sort_order);

-- Auto-update updated_at on every row change
create or replace function update_updated_at_column()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists capabilities_updated_at on capabilities;
create trigger capabilities_updated_at
  before update on capabilities
  for each row execute function update_updated_at_column();

-- 3. Visual maps generated from a catalog
create table if not exists visual_maps (
  id              uuid primary key default gen_random_uuid(),
  catalog_id      uuid not null references capability_catalogs(id) on delete cascade,
  name            text not null,                         -- e.g. "SPM Capability Map v1"
  version_number  integer default 1,                     -- increments per catalog on each Apply
  is_active       boolean default true,                  -- only one row per catalog is true
  layout_data     jsonb,                                 -- React Flow node/edge positions
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for fast "get active layout for this catalog"
create index if not exists idx_visual_maps_active on visual_maps(catalog_id, is_active);

-- 4. Diff history — lightweight audit log for AI prompt changes
create table if not exists diff_history (
  id             uuid primary key default gen_random_uuid(),
  catalog_id     uuid references capability_catalogs(id) on delete cascade,
  prompt_text    text not null,                          -- the exact user prompt
  diff_payload   jsonb not null,                         -- [{action, level, name, parent_id}...]
  status         text default 'applied',                 -- "applied" | "cancelled"
  visual_map_id  uuid references visual_maps(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_diff_history_catalog on diff_history(catalog_id);
create index if not exists idx_diff_history_created on diff_history(created_at desc);

-- 5. Row-Level Security (RLS)
alter table capability_catalogs enable row level security;
alter table capabilities        enable row level security;
alter table visual_maps         enable row level security;
alter table diff_history        enable row level security;

-- Allow authenticated users full access
create policy "Allow all for authenticated" on capability_catalogs
  for all using (auth.role() = 'authenticated');

create policy "Allow all for authenticated" on capabilities
  for all using (auth.role() = 'authenticated');

create policy "Allow all for authenticated" on visual_maps
  for all using (auth.role() = 'authenticated');

create policy "Allow all for authenticated" on diff_history
  for all using (auth.role() = 'authenticated');
