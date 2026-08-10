-- Historical schema snapshot captured before capability style categories.
-- This file is for recovery/reference and is not intended to be run directly.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.capability_catalogs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  description text,
  client_name text,
  industry text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  node_styles jsonb DEFAULT '{}'::jsonb,
  chat_history jsonb DEFAULT '{"map": []}'::jsonb,
  client_id uuid,
  notes text,
  CONSTRAINT capability_catalogs_pkey PRIMARY KEY (id),
  CONSTRAINT capability_catalogs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT capability_catalogs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.capabilities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL,
  parent_id uuid,
  level smallint NOT NULL CHECK (level >= 0 AND level <= 3),
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  source text DEFAULT 'xlsx_import'::text,
  is_deleted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  note text,
  CONSTRAINT capabilities_pkey PRIMARY KEY (id),
  CONSTRAINT capabilities_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.capability_catalogs(id),
  CONSTRAINT capabilities_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.capabilities(id)
);
CREATE TABLE public.visual_maps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL,
  name text NOT NULL,
  version_number integer DEFAULT 1,
  layout_data jsonb,
  is_active boolean DEFAULT true,
  thumbnail_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT visual_maps_pkey PRIMARY KEY (id),
  CONSTRAINT visual_maps_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.capability_catalogs(id)
);
CREATE TABLE public.diff_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  catalog_id uuid,
  applied_by uuid,
  prompt_text text NOT NULL,
  diff_payload jsonb NOT NULL,
  status text DEFAULT 'applied'::text,
  model_used text,
  visual_map_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  applied_at timestamp with time zone,
  CONSTRAINT diff_history_pkey PRIMARY KEY (id),
  CONSTRAINT diff_history_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.capability_catalogs(id),
  CONSTRAINT diff_history_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES auth.users(id),
  CONSTRAINT diff_history_visual_map_id_fkey FOREIGN KEY (visual_map_id) REFERENCES public.visual_maps(id)
);
CREATE TABLE public.capability_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  label text NOT NULL,
  level text NOT NULL,
  industry text NOT NULL,
  content text NOT NULL,
  embedding USER-DEFINED,
  source text NOT NULL,
  source_catalog_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT capability_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT capability_chunks_source_catalog_id_fkey FOREIGN KEY (source_catalog_id) REFERENCES public.capability_catalogs(id)
);
CREATE TABLE public.prompt_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  catalog_id uuid,
  user_id uuid,
  prompt text NOT NULL,
  model_used text,
  retry_count smallint DEFAULT 0,
  validation_error text,
  latency_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prompt_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT prompt_sessions_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.capability_catalogs(id),
  CONSTRAINT prompt_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.catalog_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  catalog_id uuid,
  user_id uuid,
  role text DEFAULT 'viewer'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT catalog_shares_pkey PRIMARY KEY (id),
  CONSTRAINT catalog_shares_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.capability_catalogs(id),
  CONSTRAINT catalog_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ai_usage_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  model text NOT NULL,
  mode text NOT NULL,
  prompt_tokens integer NOT NULL,
  completion_tokens integer NOT NULL,
  total_tokens integer NOT NULL,
  cost_usd numeric NOT NULL,
  CONSTRAINT ai_usage_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  description text,
  logo_url text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.client_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer'::text CHECK (role = ANY (ARRAY['admin'::text, 'editor'::text, 'viewer'::text])),
  invited_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_members_pkey PRIMARY KEY (id),
  CONSTRAINT client_members_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT client_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT client_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);
CREATE TABLE public.meeting_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  catalog_id uuid,
  mode text NOT NULL CHECK (mode = ANY (ARRAY['new_diagram'::text, 'edit_diagram'::text])),
  title text,
  meeting_date date,
  raw_text text NOT NULL,
  cleaned_text text,
  context_prompt text,
  template_id uuid,
  summary text,
  status text NOT NULL DEFAULT 'uploaded'::text,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT meeting_transcripts_pkey PRIMARY KEY (id),
  CONSTRAINT meeting_transcripts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT meeting_transcripts_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.capability_catalogs(id),
  CONSTRAINT meeting_transcripts_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.capability_catalogs(id)
);
CREATE TABLE public.transcript_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transcript_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['node'::text, 'command'::text, 'todo'::text])),
  payload jsonb NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.50 CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  source_quote text,
  selected boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'applied'::text, 'failed'::text])),
  apply_error text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transcript_proposals_pkey PRIMARY KEY (id),
  CONSTRAINT transcript_proposals_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.meeting_transcripts(id)
);
