-- ==============================================================================
-- NeuroCalm & Fokus — Migration 001: Sync Core Schema & Tenant Isolation
-- ==============================================================================
-- Baseline Architecture: SYNC-0 Approved Specification
-- Mode: Offline Schema Provisioning
-- ==============================================================================

-- 1. Dedicated Least-Privilege Function Owner Role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sync_admin_role') THEN
        CREATE ROLE sync_admin_role WITH NOLOGIN NOINHERIT;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO sync_admin_role;
GRANT USAGE ON SCHEMA auth TO sync_admin_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO sync_admin_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO sync_admin_role;

-- 2. Normalized Cloud Tables (14 Total)

-- 1) user_sync_state: Monotonic sequence state and per-user row lock
CREATE TABLE IF NOT EXISTS public.user_sync_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_server_rev BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

-- 2) device_sync_cursors: Registered devices and sync checkpoints
CREATE TABLE IF NOT EXISTS public.device_sync_cursors (
    device_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    last_synced_rev BIGINT NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    CONSTRAINT uq_device_sync_user_device UNIQUE (user_id, device_id)
);

-- 3) mutation_receipts: Decoupled durable idempotency receipts
CREATE TABLE IF NOT EXISTS public.mutation_receipts (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mutation_id UUID NOT NULL,
    payload_hash TEXT NOT NULL,
    outcome_status TEXT NOT NULL, -- 'applied', 'rejected_conflict', 'noop_already_current'
    outcome_payload JSONB NOT NULL,
    server_rev BIGINT, -- NULL when mutation rejected / does not advance revision
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    CONSTRAINT uq_mutation_receipts_user_mutation UNIQUE (user_id, mutation_id)
);

CREATE INDEX IF NOT EXISTS idx_mutation_receipts_lookup
ON public.mutation_receipts (user_id, mutation_id);

-- 4) sync_changes: Monotonic delta replication feed
CREATE TABLE IF NOT EXISTS public.sync_changes (
    change_seq BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    server_rev BIGINT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    mutation_id UUID NOT NULL,
    client_id UUID NOT NULL,
    record_data JSONB NOT NULL,
    mutation_payload_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    CONSTRAINT fk_sync_changes_receipt FOREIGN KEY (user_id, mutation_id)
        REFERENCES public.mutation_receipts (user_id, mutation_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_changes_cursor
ON public.sync_changes (user_id, server_rev ASC, change_seq ASC);

-- 5) tasks: Task domain model
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TIMESTAMPTZ,
    server_rev BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status
ON public.tasks (user_id, status) WHERE deleted_at IS NULL;

-- 6) task_conflicts: Task OCC conflict history
CREATE TABLE IF NOT EXISTS public.task_conflicts (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    task_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conflicting_fields JSONB NOT NULL,
    base_server_rev BIGINT NOT NULL,
    rejected_mutation_id UUID NOT NULL,
    rejected_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by_mutation_id UUID,
    mutation_payload_hash TEXT NOT NULL DEFAULT '',
    CONSTRAINT uq_task_conflict_mutation UNIQUE (user_id, rejected_mutation_id)
);

CREATE INDEX IF NOT EXISTS idx_task_conflicts_lookup
ON public.task_conflicts (user_id, task_id) WHERE NOT resolved;

-- 7) focus_history: Focus sessions
CREATE TABLE IF NOT EXISTS public.focus_history (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL,
    duration_minutes INT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    server_rev BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_focus_history_user_completed
ON public.focus_history (user_id, completed_at DESC);

-- 8) sleep_schedules: User sleep schedule configuration
CREATE TABLE IF NOT EXISTS public.sleep_schedules (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bedtime TEXT NOT NULL,
    wake_time TEXT NOT NULL,
    target_duration_minutes INT NOT NULL DEFAULT 480,
    days_active JSONB NOT NULL DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,
    server_rev BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    CONSTRAINT uq_sleep_schedules_user UNIQUE (user_id)
);

-- 9) sleep_prep_activities: Sleep prep definitions
CREATE TABLE IF NOT EXISTS public.sleep_prep_activities (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INT NOT NULL DEFAULT 0,
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    server_rev BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sleep_prep_activities_user
ON public.sleep_prep_activities (user_id, order_index) WHERE deleted_at IS NULL;

-- 10) sleep_prep_progress: Anchor-night discrete progress
CREATE TABLE IF NOT EXISTS public.sleep_prep_progress (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anchor_date DATE NOT NULL,
    item_states JSONB NOT NULL DEFAULT '{}'::jsonb,
    server_rev BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    CONSTRAINT uq_sleep_prep_progress_user_date UNIQUE (user_id, anchor_date)
);

-- 11) active_sleep_sessions: Single-active-session cross-device lease
CREATE TABLE IF NOT EXISTS public.active_sleep_sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anchor_date DATE NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    target_duration_minutes INT NOT NULL,
    selected_soundscape_id TEXT,
    device_id UUID NOT NULL,
    server_rev BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    CONSTRAINT uq_active_sleep_user UNIQUE (user_id)
);

-- 12) sleep_records: Historical completed sleep logs
CREATE TABLE IF NOT EXISTS public.sleep_records (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anchor_date DATE NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL,
    wake_type TEXT NOT NULL DEFAULT 'alarm',
    notes TEXT,
    server_rev BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_sleep_records_user_date
ON public.sleep_records (user_id, anchor_date DESC);

-- 13) soundscape_presets: Custom user soundscape presets
CREATE TABLE IF NOT EXISTS public.soundscape_presets (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    server_rev BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    deleted_at TIMESTAMPTZ
);

-- 14) user_settings: General preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    server_rev BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

-- 3. Row-Level Security: Enable & Force on All 14 Tables
ALTER TABLE public.user_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sync_state FORCE ROW LEVEL SECURITY;

ALTER TABLE public.device_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sync_cursors FORCE ROW LEVEL SECURITY;

ALTER TABLE public.mutation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutation_receipts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sync_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_changes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.task_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_conflicts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.focus_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_history FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sleep_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_schedules FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sleep_prep_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_prep_activities FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sleep_prep_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_prep_progress FORCE ROW LEVEL SECURITY;

ALTER TABLE public.active_sleep_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_sleep_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sleep_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.soundscape_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soundscape_presets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings FORCE ROW LEVEL SECURITY;

-- 4. Universal Isolation Policies
CREATE POLICY p_user_sync_state ON public.user_sync_state
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_device_sync_cursors ON public.device_sync_cursors
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_mutation_receipts ON public.mutation_receipts
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_sync_changes ON public.sync_changes
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_tasks ON public.tasks
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_task_conflicts ON public.task_conflicts
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_focus_history ON public.focus_history
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_sleep_schedules ON public.sleep_schedules
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_sleep_prep_activities ON public.sleep_prep_activities
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_sleep_prep_progress ON public.sleep_prep_progress
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_active_sleep_sessions ON public.active_sleep_sessions
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_sleep_records ON public.sleep_records
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_soundscape_presets ON public.soundscape_presets
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY p_user_settings ON public.user_settings
FOR ALL TO authenticated, sync_admin_role
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- 5. SQL Table-Level Grants & Revocations
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sync_admin_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO sync_admin_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated, anon;

-- Direct client CRUD permitted exclusively on device_sync_cursors (for device registration and heartbeats)
GRANT INSERT, UPDATE, DELETE ON public.device_sync_cursors TO authenticated;
