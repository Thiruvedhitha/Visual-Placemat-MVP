create table public.visual_maps (
  id uuid not null default gen_random_uuid (),
  catalog_id uuid not null,
  name text not null,
  version_number integer null default 1,
  layout_data jsonb null,
  is_active boolean null default true,
  thumbnail_url text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint visual_maps_pkey primary key (id),
  constraint visual_maps_catalog_id_fkey foreign KEY (catalog_id) references capability_catalogs (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_visual_maps_active on public.visual_maps using btree (catalog_id, is_active) TABLESPACE pg_default;

create table public.prompt_sessions (
  id uuid not null default gen_random_uuid (),
  catalog_id uuid null,
  user_id uuid null,
  prompt text not null,
  model_used text null,
  retry_count smallint null default 0,
  validation_error text null,
  latency_ms integer null,
  created_at timestamp with time zone null default now(),
  constraint prompt_sessions_pkey primary key (id),
  constraint prompt_sessions_catalog_id_fkey foreign KEY (catalog_id) references capability_catalogs (id) on delete CASCADE,
  constraint prompt_sessions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_prompt_sessions_catalog on public.prompt_sessions using btree (catalog_id) TABLESPACE pg_default;

create table public.diff_history (
  id uuid not null default gen_random_uuid (),
  catalog_id uuid null,
  applied_by uuid null,
  prompt_text text not null,
  diff_payload jsonb not null,
  status text null default 'applied'::text,
  model_used text null,
  visual_map_id uuid null,
  created_at timestamp with time zone null default now(),
  applied_at timestamp with time zone null,
  constraint diff_history_pkey primary key (id),
  constraint diff_history_applied_by_fkey foreign KEY (applied_by) references auth.users (id) on delete set null,
  constraint diff_history_catalog_id_fkey foreign KEY (catalog_id) references capability_catalogs (id) on delete CASCADE,
  constraint diff_history_visual_map_id_fkey foreign KEY (visual_map_id) references visual_maps (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_diff_history_catalog on public.diff_history using btree (catalog_id) TABLESPACE pg_default;

create index IF not exists idx_diff_history_applied on public.diff_history using btree (applied_by) TABLESPACE pg_default;

create table public.catalog_shares (
  id uuid not null default gen_random_uuid (),
  catalog_id uuid null,
  user_id uuid null,
  role text null default 'viewer'::text,
  created_at timestamp with time zone null default now(),
  constraint catalog_shares_pkey primary key (id),
  constraint catalog_shares_catalog_id_user_id_key unique (catalog_id, user_id),
  constraint catalog_shares_catalog_id_fkey foreign KEY (catalog_id) references capability_catalogs (id) on delete CASCADE,
  constraint catalog_shares_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.capability_chunks (
  id uuid not null default gen_random_uuid (),
  label text not null,
  level text not null,
  industry text not null,
  content text not null,
  embedding public.vector null,
  source text not null,
  source_catalog_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint capability_chunks_pkey primary key (id),
  constraint capability_chunks_source_catalog_id_fkey foreign KEY (source_catalog_id) references capability_catalogs (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_chunks_embedding on public.capability_chunks using ivfflat (embedding vector_cosine_ops)
with
  (lists = '100') TABLESPACE pg_default;

create index IF not exists idx_chunks_industry on public.capability_chunks using btree (industry) TABLESPACE pg_default;

create table public.capability_catalogs (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  name text not null,
  description text null,
  client_name text null,
  industry text null,
  status text null default 'active'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  node_styles jsonb null default '{}'::jsonb,
  chat_history jsonb null default '{"map": []}'::jsonb,
  constraint capability_catalogs_pkey primary key (id),
  constraint capability_catalogs_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.capabilities (
  id uuid not null default gen_random_uuid (),
  catalog_id uuid not null,
  parent_id uuid null,
  level smallint not null,
  name text not null,
  description text null,
  sort_order integer null default 0,
  source text null default 'xlsx_import'::text,
  is_deleted boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  note text null,
  constraint capabilities_pkey primary key (id),
  constraint capabilities_catalog_id_fkey foreign KEY (catalog_id) references capability_catalogs (id) on delete CASCADE,
  constraint capabilities_parent_id_fkey foreign KEY (parent_id) references capabilities (id) on delete set null,
  constraint capabilities_level_check check (
    (
      (level >= 0)
      and (level <= 3)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_capabilities_catalog on public.capabilities using btree (catalog_id) TABLESPACE pg_default;

create index IF not exists idx_capabilities_parent on public.capabilities using btree (parent_id) TABLESPACE pg_default;

create index IF not exists idx_capabilities_level on public.capabilities using btree (catalog_id, level) TABLESPACE pg_default;

create index IF not exists idx_capabilities_catalog_sort on public.capabilities using btree (catalog_id, sort_order) TABLESPACE pg_default;

create trigger capabilities_updated_at BEFORE
update on capabilities for EACH row
execute FUNCTION update_updated_at_column ();