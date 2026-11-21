-- ==============================================================================
-- NeuroCalm & Fokus — Migration 002: Sync RPC Gateway & Idempotency Engine
-- ==============================================================================
-- Baseline Architecture: SYNC-0 Approved Specification
-- Mode: Offline Stored Procedure Provisioning
-- ==============================================================================

-- 1. Native Canonical Hashing Helper (Zero External Extensions)
CREATE OR REPLACE FUNCTION public.canonical_hash_payload(p_payload JSONB)
RETURNS TEXT AS $$
BEGIN
    RETURN pg_catalog.encode(
        pg_catalog.sha256(
            pg_catalog.convert_to(p_payload::text, 'UTF8')
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = '';

-- 2. Keyset-Paginated Delta Change Retrieval
CREATE OR REPLACE FUNCTION public.get_sync_changes(
    p_after_rev BIGINT,
    p_after_change_seq BIGINT,
    p_target_rev BIGINT,
    p_limit INT DEFAULT 100
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_changes JSONB := '[]'::jsonb;
    v_has_more BOOLEAN := false;
    v_last_rev BIGINT := p_after_rev;
    v_last_seq BIGINT := p_after_change_seq;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    WITH candidate_rows AS (
        SELECT change_seq, server_rev, entity_type, entity_id, operation, mutation_id, record_data
        FROM public.sync_changes
        WHERE user_id = v_user_id
          AND (
            server_rev > p_after_rev
            OR (server_rev = p_after_rev AND change_seq > p_after_change_seq)
          )
          AND server_rev <= p_target_rev
        ORDER BY server_rev ASC, change_seq ASC
        LIMIT p_limit + 1
    ),
    sliced_page AS (
        SELECT * FROM candidate_rows LIMIT p_limit
    ),
    aggregated AS (
        SELECT
            COALESCE(
                jsonb_agg(row_to_json(s) ORDER BY s.server_rev ASC, s.change_seq ASC),
                '[]'::jsonb
            ) AS change_list,
            EXISTS (SELECT 1 FROM candidate_rows OFFSET p_limit) AS more_rows
        FROM sliced_page s
    ),
    last_row AS (
        SELECT server_rev, change_seq
        FROM sliced_page
        ORDER BY server_rev DESC, change_seq DESC
        LIMIT 1
    )
    SELECT
        a.change_list,
        a.more_rows,
        COALESCE(l.server_rev, p_after_rev),
        COALESCE(l.change_seq, p_after_change_seq)
    INTO v_changes, v_has_more, v_last_rev, v_last_seq
    FROM aggregated a
    LEFT JOIN last_row l ON true;

    RETURN jsonb_build_object(
        'changes', v_changes,
        'hasMore', v_has_more,
        'lastRev', v_last_rev,
        'lastSeq', v_last_seq,
        'targetRev', p_target_rev
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 3. Sleep Prep Item Discrete State Transition
CREATE OR REPLACE FUNCTION public.update_sleep_prep_item(
    p_anchor_date DATE,
    p_activity_id TEXT,
    p_new_status TEXT,
    p_base_item_rev BIGINT,
    p_mutation_id UUID,
    p_device_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_incoming_hash TEXT;
    v_canonical_payload JSONB;
    v_receipt public.mutation_receipts%ROWTYPE;
    v_current_server_rev BIGINT;
    v_next_rev BIGINT;
    v_progress public.sleep_prep_progress%ROWTYPE;
    v_current_item JSONB;
    v_current_item_rev BIGINT;
    v_new_item JSONB;
    v_stable_entity_id UUID;
    v_is_valid_activity BOOLEAN;
    v_result JSONB;
BEGIN
    -- 1. Pre-idempotency validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF p_mutation_id IS NULL THEN
        RAISE EXCEPTION 'Missing mutation ID' USING ERRCODE = '22023';
    END IF;
    IF p_new_status NOT IN ('pending', 'completed', 'skipped') THEN
        RAISE EXCEPTION 'Invalid status: %', p_new_status USING ERRCODE = '22023';
    END IF;

    -- Device validation
    IF NOT EXISTS (SELECT 1 FROM public.device_sync_cursors WHERE device_id = p_device_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Unauthorized device ID: %', p_device_id USING ERRCODE = '42501';
    END IF;

    -- Activity validation
    SELECT EXISTS (
        SELECT 1 FROM public.sleep_prep_activities
        WHERE user_id = v_user_id AND id::text = p_activity_id AND deleted_at IS NULL
        UNION
        SELECT 1 WHERE p_activity_id IN ('prep_dim_lights', 'prep_breathing', 'prep_relaxation', 'prep_sounds')
    ) INTO v_is_valid_activity;

    IF NOT v_is_valid_activity THEN
        RAISE EXCEPTION 'Invalid or deleted activity ID: %', p_activity_id USING ERRCODE = '22023';
    END IF;

    -- 2. Server-owned canonical payload
    v_canonical_payload := jsonb_build_object(
        'rpc', 'update_sleep_prep_item',
        'anchor_date', p_anchor_date::text,
        'activity_id', lower(trim(p_activity_id)),
        'new_status', lower(trim(p_new_status)),
        'base_item_rev', p_base_item_rev,
        'device_id', lower(p_device_id::text)
    );
    v_incoming_hash := public.canonical_hash_payload(v_canonical_payload);

    -- 3. Lock user state row
    INSERT INTO public.user_sync_state (user_id, last_server_rev, updated_at)
    VALUES (v_user_id, 0, pg_catalog.clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT last_server_rev INTO v_current_server_rev
    FROM public.user_sync_state
    WHERE user_id = v_user_id
    FOR UPDATE;

    -- 4. Definitive idempotency check
    SELECT * INTO v_receipt
    FROM public.mutation_receipts
    WHERE user_id = v_user_id AND mutation_id = p_mutation_id;

    IF FOUND THEN
        IF v_receipt.payload_hash <> v_incoming_hash THEN
            RAISE EXCEPTION 'Idempotency key reuse: mutation ID % already processed with different payload', p_mutation_id
                USING ERRCODE = '23505';
        END IF;
        RETURN v_receipt.outcome_payload;
    END IF;

    -- 5. Lock or create progress row
    INSERT INTO public.sleep_prep_progress (
        user_id, anchor_date, item_states, server_rev, updated_at
    ) VALUES (
        v_user_id, p_anchor_date, '{}'::jsonb, v_current_server_rev, pg_catalog.clock_timestamp()
    ) ON CONFLICT (user_id, anchor_date) DO NOTHING;

    SELECT * INTO v_progress
    FROM public.sleep_prep_progress
    WHERE user_id = v_user_id AND anchor_date = p_anchor_date
    FOR UPDATE;

    v_current_item := v_progress.item_states->p_activity_id;
    v_current_item_rev := COALESCE((v_current_item->>'server_rev')::bigint, 0);

    -- 6. Exact OCC validation
    IF p_base_item_rev > v_current_item_rev THEN
        RAISE EXCEPTION 'Protocol error: submitted base revision % exceeds server revision %',
            p_base_item_rev, v_current_item_rev USING ERRCODE = '22000';
    ELSIF v_current_item_rev > p_base_item_rev THEN
        -- Stable rejection: Persist receipt and commit
        v_result := jsonb_build_object(
            'status', 'conflict',
            'conflictType', 'item_revision_mismatch',
            'activityId', p_activity_id,
            'currentStatus', v_current_item->>'status',
            'currentServerRev', v_current_item_rev,
            'attemptedStatus', p_new_status
        );

        INSERT INTO public.mutation_receipts (
            user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
        ) VALUES (
            v_user_id, p_mutation_id, v_incoming_hash, 'rejected_conflict', v_result, NULL
        );

        RETURN v_result;
    END IF;

    -- 7. Apply update
    v_next_rev := v_current_server_rev + 1;
    v_new_item := jsonb_build_object(
        'status', p_new_status,
        'server_rev', v_next_rev,
        'updated_at', pg_catalog.clock_timestamp(),
        'mutation_id', p_mutation_id,
        'device_id', p_device_id
    );

    v_stable_entity_id := CAST(md5('sleep_prep_item:' || v_user_id::text || ':' || p_anchor_date::text || ':' || p_activity_id) AS UUID);

    UPDATE public.sleep_prep_progress
    SET item_states = jsonb_set(item_states, ARRAY[p_activity_id], v_new_item, true),
        server_rev = v_next_rev,
        updated_at = pg_catalog.clock_timestamp()
    WHERE user_id = v_user_id AND anchor_date = p_anchor_date;

    UPDATE public.user_sync_state
    SET last_server_rev = v_next_rev, updated_at = pg_catalog.clock_timestamp()
    WHERE user_id = v_user_id;

    v_result := jsonb_build_object(
        'status', 'applied',
        'serverRev', v_next_rev,
        'activityId', p_activity_id,
        'newStatus', p_new_status
    );

    INSERT INTO public.mutation_receipts (
        user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
    ) VALUES (
        v_user_id, p_mutation_id, v_incoming_hash, 'applied', v_result, v_next_rev
    );

    INSERT INTO public.sync_changes (
        user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
    ) VALUES (
        v_user_id, 'sleep_prep_progress', v_stable_entity_id, 'UPDATE', p_mutation_id, p_device_id, v_next_rev,
        jsonb_build_object('anchorDate', p_anchor_date, 'activityId', p_activity_id, 'item', v_new_item),
        v_incoming_hash
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 4. Start Active Sleep Session Lease
CREATE OR REPLACE FUNCTION public.start_active_sleep_session(
    p_session_id UUID,
    p_anchor_date DATE,
    p_started_at TIMESTAMPTZ,
    p_target_duration_minutes INT,
    p_selected_soundscape_id TEXT,
    p_device_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_incoming_hash TEXT;
    v_canonical_payload JSONB;
    v_receipt public.mutation_receipts%ROWTYPE;
    v_current_server_rev BIGINT;
    v_next_rev BIGINT;
    v_existing_session public.active_sleep_sessions%ROWTYPE;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    v_canonical_payload := jsonb_build_object(
        'rpc', 'start_active_sleep_session',
        'session_id', lower(p_session_id::text),
        'anchor_date', p_anchor_date::text,
        'started_at', to_char(p_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'target_duration_minutes', p_target_duration_minutes,
        'selected_soundscape_id', COALESCE(lower(trim(p_selected_soundscape_id)), 'null'),
        'device_id', lower(p_device_id::text)
    );
    v_incoming_hash := public.canonical_hash_payload(v_canonical_payload);

    INSERT INTO public.user_sync_state (user_id, last_server_rev, updated_at)
    VALUES (v_user_id, 0, pg_catalog.clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT last_server_rev INTO v_current_server_rev
    FROM public.user_sync_state
    WHERE user_id = v_user_id
    FOR UPDATE;

    SELECT * INTO v_receipt
    FROM public.mutation_receipts
    WHERE user_id = v_user_id AND mutation_id = p_session_id;

    IF FOUND THEN
        IF v_receipt.payload_hash <> v_incoming_hash THEN
            RAISE EXCEPTION 'Idempotency key reuse: mutation ID % already processed with different payload', p_session_id
                USING ERRCODE = '23505';
        END IF;
        RETURN v_receipt.outcome_payload;
    END IF;

    -- Check active lease
    SELECT * INTO v_existing_session
    FROM public.active_sleep_sessions
    WHERE user_id = v_user_id;

    IF FOUND THEN
        v_result := jsonb_build_object(
            'status', 'conflict',
            'conflictType', 'active_session_lease_held',
            'activeSessionId', v_existing_session.session_id,
            'activeDeviceId', v_existing_session.device_id,
            'startedAt', v_existing_session.started_at
        );

        INSERT INTO public.mutation_receipts (
            user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
        ) VALUES (
            v_user_id, p_session_id, v_incoming_hash, 'rejected_conflict', v_result, NULL
        );

        RETURN v_result;
    END IF;

    v_next_rev := v_current_server_rev + 1;

    INSERT INTO public.active_sleep_sessions (
        session_id, user_id, anchor_date, started_at, target_duration_minutes, selected_soundscape_id, device_id, server_rev, updated_at
    ) VALUES (
        p_session_id, v_user_id, p_anchor_date, p_started_at, p_target_duration_minutes, p_selected_soundscape_id, p_device_id, v_next_rev, pg_catalog.clock_timestamp()
    );

    UPDATE public.user_sync_state SET last_server_rev = v_next_rev, updated_at = pg_catalog.clock_timestamp() WHERE user_id = v_user_id;

    v_result := jsonb_build_object('status', 'applied', 'serverRev', v_next_rev, 'sessionId', p_session_id);

    INSERT INTO public.mutation_receipts (
        user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
    ) VALUES (
        v_user_id, p_session_id, v_incoming_hash, 'applied', v_result, v_next_rev
    );

    INSERT INTO public.sync_changes (
        user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
    ) VALUES (
        v_user_id, 'active_sleep_sessions', p_session_id, 'INSERT', p_session_id, p_device_id, v_next_rev,
        v_canonical_payload, v_incoming_hash
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. Complete Active Sleep Session and Create Sleep Record
CREATE OR REPLACE FUNCTION public.complete_active_sleep_session(
    p_session_id UUID,
    p_completed_at TIMESTAMPTZ,
    p_wake_type TEXT,
    p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_incoming_hash TEXT;
    v_canonical_payload JSONB;
    v_receipt public.mutation_receipts%ROWTYPE;
    v_session public.active_sleep_sessions%ROWTYPE;
    v_existing_record public.sleep_records%ROWTYPE;
    v_current_server_rev BIGINT;
    v_next_rev BIGINT;
    v_duration_minutes INT;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    v_canonical_payload := jsonb_build_object(
        'rpc', 'complete_active_sleep_session',
        'session_id', lower(p_session_id::text),
        'completed_at', to_char(p_completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'wake_type', lower(trim(p_wake_type)),
        'notes', COALESCE(trim(p_notes), 'null')
    );
    v_incoming_hash := public.canonical_hash_payload(v_canonical_payload);

    INSERT INTO public.user_sync_state (user_id, last_server_rev, updated_at)
    VALUES (v_user_id, 0, pg_catalog.clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT last_server_rev INTO v_current_server_rev
    FROM public.user_sync_state
    WHERE user_id = v_user_id
    FOR UPDATE;

    SELECT * INTO v_receipt
    FROM public.mutation_receipts
    WHERE user_id = v_user_id AND mutation_id = p_session_id;

    IF FOUND THEN
        IF v_receipt.payload_hash <> v_incoming_hash THEN
            RAISE EXCEPTION 'Idempotency key reuse: mutation ID % already processed with different payload', p_session_id
                USING ERRCODE = '23505';
        END IF;
        RETURN v_receipt.outcome_payload;
    END IF;

    SELECT * INTO v_session
    FROM public.active_sleep_sessions
    WHERE session_id = p_session_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        SELECT * INTO v_existing_record FROM public.sleep_records WHERE id = p_session_id AND user_id = v_user_id;
        IF FOUND THEN
            v_result := jsonb_build_object('status', 'noop_already_completed', 'sessionId', p_session_id);
            INSERT INTO public.mutation_receipts (
                user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
            ) VALUES (
                v_user_id, p_session_id, v_incoming_hash, 'noop_already_current', v_result, NULL
            );
            RETURN v_result;
        END IF;
        RAISE EXCEPTION 'Active sleep session not found: %', p_session_id USING ERRCODE = 'P0002';
    END IF;

    v_next_rev := v_current_server_rev + 1;
    v_duration_minutes := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (p_completed_at - v_session.started_at)) / 60));

    DELETE FROM public.active_sleep_sessions WHERE session_id = p_session_id AND user_id = v_user_id;

    INSERT INTO public.sleep_records (
        id, user_id, anchor_date, started_at, completed_at, duration_minutes, wake_type, notes, server_rev, created_at
    ) VALUES (
        p_session_id, v_user_id, v_session.anchor_date, v_session.started_at, p_completed_at, v_duration_minutes, p_wake_type, p_notes, v_next_rev, pg_catalog.clock_timestamp()
    );

    UPDATE public.user_sync_state SET last_server_rev = v_next_rev, updated_at = pg_catalog.clock_timestamp() WHERE user_id = v_user_id;

    v_result := jsonb_build_object('status', 'applied', 'serverRev', v_next_rev, 'sessionId', p_session_id, 'durationMinutes', v_duration_minutes);

    INSERT INTO public.mutation_receipts (
        user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
    ) VALUES (
        v_user_id, p_session_id, v_incoming_hash, 'applied', v_result, v_next_rev
    );

    INSERT INTO public.sync_changes (
        user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
    ) VALUES (
        v_user_id, 'active_sleep_sessions', p_session_id, 'DELETE', p_session_id, v_session.device_id, v_next_rev,
        jsonb_build_object('sessionId', p_session_id), v_incoming_hash
    );

    INSERT INTO public.sync_changes (
        user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
    ) VALUES (
        v_user_id, 'sleep_records', p_session_id, 'INSERT', p_session_id, v_session.device_id, v_next_rev,
        jsonb_build_object('id', p_session_id, 'anchorDate', v_session.anchor_date, 'durationMinutes', v_duration_minutes), v_incoming_hash
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 6. Task Conflict Resolution Gateway
CREATE OR REPLACE FUNCTION public.resolve_task_conflict(
    p_conflict_id UUID,
    p_resolution_action TEXT, -- 'apply_rejected', 'keep_current', 'apply_custom'
    p_resolved_task_data JSONB,
    p_base_server_rev BIGINT,
    p_mutation_id UUID,
    p_device_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_incoming_hash TEXT;
    v_canonical_payload JSONB;
    v_receipt public.mutation_receipts%ROWTYPE;
    v_conflict public.task_conflicts%ROWTYPE;
    v_task public.tasks%ROWTYPE;
    v_current_server_rev BIGINT;
    v_next_rev BIGINT;
    v_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    IF p_resolution_action NOT IN ('apply_rejected', 'keep_current', 'apply_custom') THEN
        RAISE EXCEPTION 'Invalid resolution action: %', p_resolution_action USING ERRCODE = '22023';
    END IF;

    v_canonical_payload := jsonb_build_object(
        'rpc', 'resolve_task_conflict',
        'conflict_id', lower(p_conflict_id::text),
        'action', lower(trim(p_resolution_action)),
        'resolved_data', COALESCE(p_resolved_task_data, 'null'::jsonb),
        'base_rev', p_base_server_rev,
        'device_id', lower(p_device_id::text)
    );
    v_incoming_hash := public.canonical_hash_payload(v_canonical_payload);

    INSERT INTO public.user_sync_state (user_id, last_server_rev, updated_at)
    VALUES (v_user_id, 0, pg_catalog.clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT last_server_rev INTO v_current_server_rev
    FROM public.user_sync_state
    WHERE user_id = v_user_id
    FOR UPDATE;

    SELECT * INTO v_receipt
    FROM public.mutation_receipts
    WHERE user_id = v_user_id AND mutation_id = p_mutation_id;

    IF FOUND THEN
        IF v_receipt.payload_hash <> v_incoming_hash THEN
            RAISE EXCEPTION 'Idempotency key reuse: mutation ID % already processed with different payload', p_mutation_id
                USING ERRCODE = '23505';
        END IF;
        RETURN v_receipt.outcome_payload;
    END IF;

    SELECT * INTO v_conflict
    FROM public.task_conflicts
    WHERE id = p_conflict_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conflict record not found: %', p_conflict_id USING ERRCODE = 'P0002';
    END IF;

    IF v_conflict.resolved THEN
        RETURN jsonb_build_object('status', 'already_resolved', 'conflictId', p_conflict_id);
    END IF;

    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = v_conflict.task_id AND user_id = v_user_id
    FOR UPDATE;

    -- Deletion handling: never resurrect
    IF NOT FOUND OR v_task.deleted_at IS NOT NULL THEN
        v_next_rev := v_current_server_rev + 1;

        UPDATE public.task_conflicts
        SET resolved = true, resolved_at = pg_catalog.clock_timestamp(), resolved_by_mutation_id = p_mutation_id
        WHERE id = p_conflict_id;

        v_result := jsonb_build_object(
            'status', 'task_deleted_conflict_dismissed',
            'conflictId', p_conflict_id,
            'serverRev', v_next_rev
        );

        -- Insert receipt FIRST before sync_changes
        INSERT INTO public.mutation_receipts (
            user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
        ) VALUES (
            v_user_id, p_mutation_id, v_incoming_hash, 'applied', v_result, v_next_rev
        );

        -- Emit sync_changes event so peer devices dismiss the conflict dialog
        INSERT INTO public.sync_changes (
            user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
        ) VALUES (
            v_user_id, 'task_conflicts', p_conflict_id, 'UPDATE', p_mutation_id, p_device_id, v_next_rev,
            jsonb_build_object('conflictId', p_conflict_id, 'resolved', true, 'action', 'dismiss_deleted_task'),
            v_incoming_hash
        );

        UPDATE public.user_sync_state SET last_server_rev = v_next_rev, updated_at = pg_catalog.clock_timestamp() WHERE user_id = v_user_id;

        RETURN v_result;
    END IF;

    -- Stale resolution rejection
    IF v_task.server_rev > p_base_server_rev THEN
        v_result := jsonb_build_object(
            'status', 'conflict',
            'conflictType', 'stale_resolution_rejected',
            'conflictId', p_conflict_id,
            'currentServerRev', v_task.server_rev,
            'submittedBaseRev', p_base_server_rev
        );

        INSERT INTO public.mutation_receipts (
            user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
        ) VALUES (
            v_user_id, p_mutation_id, v_incoming_hash, 'rejected_conflict', v_result, NULL
        );

        RETURN v_result;
    END IF;

    v_next_rev := v_current_server_rev + 1;
    v_result := jsonb_build_object('status', 'applied', 'serverRev', v_next_rev, 'conflictId', p_conflict_id, 'taskId', v_conflict.task_id);

    -- 1. Insert receipt FIRST before any sync_changes
    INSERT INTO public.mutation_receipts (
        user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
    ) VALUES (
        v_user_id, p_mutation_id, v_incoming_hash, 'applied', v_result, v_next_rev
    );

    -- 2. If user applied changes, update tasks and emit tasks sync_change
    IF p_resolution_action IN ('apply_rejected', 'apply_custom') THEN
        UPDATE public.tasks
        SET title = COALESCE(p_resolved_task_data->>'title', title),
            notes = COALESCE(p_resolved_task_data->>'notes', notes),
            priority = COALESCE((p_resolved_task_data->>'priority')::text, priority),
            due_date = COALESCE((p_resolved_task_data->>'due_date')::timestamptz, due_date),
            status = COALESCE((p_resolved_task_data->>'status')::text, status),
            server_rev = v_next_rev,
            updated_at = pg_catalog.clock_timestamp()
        WHERE id = v_conflict.task_id AND user_id = v_user_id;

        INSERT INTO public.sync_changes (
            user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
        ) VALUES (
            v_user_id, 'tasks', v_conflict.task_id, 'UPDATE', p_mutation_id, p_device_id, v_next_rev,
            p_resolved_task_data, v_incoming_hash
        );
    END IF;

    -- 3. Update task_conflicts and emit task_conflicts sync_change with p_mutation_id
    UPDATE public.task_conflicts
    SET resolved = true, resolved_at = pg_catalog.clock_timestamp(), resolved_by_mutation_id = p_mutation_id
    WHERE id = p_conflict_id;

    INSERT INTO public.sync_changes (
        user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
    ) VALUES (
        v_user_id, 'task_conflicts', p_conflict_id, 'UPDATE', p_mutation_id, p_device_id, v_next_rev,
        jsonb_build_object('conflictId', p_conflict_id, 'resolved', true, 'action', p_resolution_action), v_incoming_hash
    );

    UPDATE public.user_sync_state SET last_server_rev = v_next_rev, updated_at = pg_catalog.clock_timestamp() WHERE user_id = v_user_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7. Batch Mutation Engine
CREATE OR REPLACE FUNCTION public.sync_apply_batch(p_mutations JSONB)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_current_server_rev BIGINT;
    v_batch_base_rev BIGINT;
    v_mutation JSONB;
    v_mutation_id UUID;
    v_entity_type TEXT;
    v_entity_id UUID;
    v_operation TEXT;
    v_base_rev BIGINT;
    v_client_id UUID;
    v_record_data JSONB;
    v_item_hash TEXT;
    v_canonical_item JSONB;
    v_receipt public.mutation_receipts%ROWTYPE;
    v_existing_task public.tasks%ROWTYPE;
    v_existing_schedule public.sleep_schedules%ROWTYPE;
    v_existing_settings public.user_settings%ROWTYPE;
    v_existing_preset public.soundscape_presets%ROWTYPE;
    v_existing_activity public.sleep_prep_activities%ROWTYPE;
    v_conflict_id UUID;
    v_results JSONB := '[]'::jsonb;
    v_item_result JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    -- 1. Initialize and lock user sequence state
    INSERT INTO public.user_sync_state (user_id, last_server_rev, updated_at)
    VALUES (v_user_id, 0, pg_catalog.clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT last_server_rev INTO v_current_server_rev
    FROM public.user_sync_state
    WHERE user_id = v_user_id
    FOR UPDATE;

    v_batch_base_rev := v_current_server_rev;

    -- 2. Process each mutation item sequentially
    FOR v_mutation IN SELECT * FROM jsonb_array_elements(p_mutations) LOOP
        v_mutation_id := (v_mutation->>'mutation_id')::uuid;
        v_entity_type := lower(trim(v_mutation->>'entity_type'));
        v_entity_id := (v_mutation->>'entity_id')::uuid;
        v_operation := upper(trim(v_mutation->>'operation'));
        v_base_rev := COALESCE((v_mutation->>'base_server_rev')::bigint, 0);
        v_client_id := (v_mutation->>'client_id')::uuid;
        v_record_data := COALESCE(v_mutation->'record_data', '{}'::jsonb);

        -- Construct server canonical representation
        v_canonical_item := jsonb_build_object(
            'mutation_id', lower(v_mutation_id::text),
            'entity_type', v_entity_type,
            'entity_id', lower(v_entity_id::text),
            'operation', v_operation,
            'base_server_rev', v_base_rev,
            'client_id', lower(v_client_id::text),
            'record_data', v_record_data
        );
        v_item_hash := public.canonical_hash_payload(v_canonical_item);

        -- Check existing receipt
        SELECT * INTO v_receipt
        FROM public.mutation_receipts
        WHERE user_id = v_user_id AND mutation_id = v_mutation_id;

        IF FOUND THEN
            IF v_receipt.payload_hash <> v_item_hash THEN
                RAISE EXCEPTION 'Idempotency key reuse: mutation ID % already processed with different payload', v_mutation_id
                    USING ERRCODE = '23505';
            END IF;
            v_results := v_results || jsonb_build_array(v_receipt.outcome_payload);
            CONTINUE;
        END IF;

        -- OCC Evaluation & Execution
        IF v_entity_type = 'tasks' THEN
            SELECT * INTO v_existing_task FROM public.tasks WHERE id = v_entity_id AND user_id = v_user_id FOR UPDATE;

            IF FOUND AND v_existing_task.server_rev > v_base_rev THEN
                -- Task OCC Conflict: Advance rev and record conflict event
                v_current_server_rev := v_current_server_rev + 1;
                v_conflict_id := pg_catalog.gen_random_uuid();

                INSERT INTO public.task_conflicts (
                    id, task_id, user_id, conflicting_fields, base_server_rev, rejected_mutation_id, mutation_payload_hash
                ) VALUES (
                    v_conflict_id, v_entity_id, v_user_id, v_record_data, v_base_rev, v_mutation_id, v_item_hash
                );

                v_item_result := jsonb_build_object(
                    'status', 'conflict',
                    'mutationId', v_mutation_id,
                    'conflictType', 'version_mismatch',
                    'conflictId', v_conflict_id,
                    'conflictServerRev', v_current_server_rev,
                    'baseServerRev', v_base_rev,
                    'currentServerRev', v_existing_task.server_rev
                );

                -- 1. Insert receipt FIRST before sync_changes
                INSERT INTO public.mutation_receipts (
                    user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
                ) VALUES (
                    v_user_id, v_mutation_id, v_item_hash, 'rejected_conflict', v_item_result, NULL
                );

                -- 2. Insert sync_changes referencing the receipt
                INSERT INTO public.sync_changes (
                    user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
                ) VALUES (
                    v_user_id, 'task_conflicts', v_conflict_id, 'INSERT', v_mutation_id, v_client_id, v_current_server_rev,
                    jsonb_build_object('conflictId', v_conflict_id, 'taskId', v_entity_id, 'conflictingFields', v_record_data),
                    v_item_hash
                );

                v_results := v_results || jsonb_build_array(v_item_result);
                CONTINUE;
            END IF;

            -- Accepted task write
            v_current_server_rev := v_current_server_rev + 1;

            IF v_operation = 'INSERT' THEN
                INSERT INTO public.tasks (
                    id, user_id, title, notes, status, priority, due_date, server_rev, created_at, updated_at
                ) VALUES (
                    v_entity_id, v_user_id,
                    v_record_data->>'title',
                    v_record_data->>'notes',
                    COALESCE(v_record_data->>'status', 'pending'),
                    COALESCE(v_record_data->>'priority', 'medium'),
                    (v_record_data->>'due_date')::timestamptz,
                    v_current_server_rev,
                    pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
                );
            ELSIF v_operation = 'UPDATE' THEN
                UPDATE public.tasks
                SET title = COALESCE(v_record_data->>'title', title),
                    notes = COALESCE(v_record_data->>'notes', notes),
                    status = COALESCE(v_record_data->>'status', status),
                    priority = COALESCE(v_record_data->>'priority', priority),
                    due_date = COALESCE((v_record_data->>'due_date')::timestamptz, due_date),
                    server_rev = v_current_server_rev,
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_entity_id AND user_id = v_user_id;
            ELSIF v_operation = 'DELETE' THEN
                UPDATE public.tasks
                SET deleted_at = pg_catalog.clock_timestamp(), server_rev = v_current_server_rev, updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_entity_id AND user_id = v_user_id;
            END IF;

            v_item_result := jsonb_build_object('status', 'applied', 'mutationId', v_mutation_id, 'serverRev', v_current_server_rev);

            INSERT INTO public.mutation_receipts (
                user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
            ) VALUES (
                v_user_id, v_mutation_id, v_item_hash, 'applied', v_item_result, v_current_server_rev
            );

            INSERT INTO public.sync_changes (
                user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
            ) VALUES (
                v_user_id, 'tasks', v_entity_id, v_operation, v_mutation_id, v_client_id, v_current_server_rev,
                v_record_data, v_item_hash
            );

            v_results := v_results || jsonb_build_array(v_item_result);

        ELSIF v_entity_type = 'focus_history' THEN
            v_current_server_rev := v_current_server_rev + 1;

            IF v_operation = 'INSERT' THEN
                INSERT INTO public.focus_history (
                    id, user_id, session_type, duration_minutes, completed_at, notes, server_rev, created_at
                ) VALUES (
                    v_entity_id, v_user_id,
                    COALESCE(v_record_data->>'session_type', v_record_data->>'sessionType', 'focus'),
                    COALESCE((v_record_data->>'duration_minutes')::int, (v_record_data->>'durationMinutes')::int, 25),
                    COALESCE((v_record_data->>'completed_at')::timestamptz, (v_record_data->>'completedAt')::timestamptz, pg_catalog.clock_timestamp()),
                    v_record_data->>'notes',
                    v_current_server_rev,
                    pg_catalog.clock_timestamp()
                )
                ON CONFLICT (id) DO NOTHING;
            ELSIF v_operation = 'DELETE' THEN
                DELETE FROM public.focus_history
                WHERE id = v_entity_id AND user_id = v_user_id;
            END IF;

            v_item_result := jsonb_build_object('status', 'applied', 'mutationId', v_mutation_id, 'serverRev', v_current_server_rev);

            INSERT INTO public.mutation_receipts (
                user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
            ) VALUES (
                v_user_id, v_mutation_id, v_item_hash, 'applied', v_item_result, v_current_server_rev
            );

            INSERT INTO public.sync_changes (
                user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
            ) VALUES (
                v_user_id, 'focus_history', v_entity_id, v_operation, v_mutation_id, v_client_id, v_current_server_rev,
                v_record_data, v_item_hash
            );

            v_results := v_results || jsonb_build_array(v_item_result);

        ELSIF v_entity_type = 'sleep_schedules' THEN
            SELECT * INTO v_existing_schedule FROM public.sleep_schedules WHERE user_id = v_user_id FOR UPDATE;

            IF FOUND AND v_existing_schedule.server_rev > v_base_rev THEN
                v_item_result := jsonb_build_object(
                    'status', 'conflict',
                    'mutationId', v_mutation_id,
                    'conflictType', 'version_mismatch',
                    'baseServerRev', v_base_rev,
                    'currentServerRev', v_existing_schedule.server_rev
                );

                INSERT INTO public.mutation_receipts (
                    user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
                ) VALUES (
                    v_user_id, v_mutation_id, v_item_hash, 'rejected_conflict', v_item_result, NULL
                );

                v_results := v_results || jsonb_build_array(v_item_result);
                CONTINUE;
            END IF;

            v_current_server_rev := v_current_server_rev + 1;

            INSERT INTO public.sleep_schedules (
                id, user_id, bedtime, wake_time, target_duration_minutes, days_active, server_rev, updated_at
            ) VALUES (
                v_entity_id, v_user_id,
                COALESCE(v_record_data->>'bedtime', '22:30'),
                COALESCE(v_record_data->>'wake_time', v_record_data->>'wakeTime', '06:30'),
                COALESCE((v_record_data->>'target_duration_minutes')::int, (v_record_data->>'targetDurationMinutes')::int, 480),
                COALESCE(v_record_data->'days_active', v_record_data->'daysActive', '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb),
                v_current_server_rev,
                pg_catalog.clock_timestamp()
            )
            ON CONFLICT (user_id) DO UPDATE
            SET bedtime = EXCLUDED.bedtime,
                wake_time = EXCLUDED.wake_time,
                target_duration_minutes = EXCLUDED.target_duration_minutes,
                days_active = EXCLUDED.days_active,
                server_rev = EXCLUDED.server_rev,
                updated_at = EXCLUDED.updated_at;

            v_item_result := jsonb_build_object('status', 'applied', 'mutationId', v_mutation_id, 'serverRev', v_current_server_rev);

            INSERT INTO public.mutation_receipts (
                user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
            ) VALUES (
                v_user_id, v_mutation_id, v_item_hash, 'applied', v_item_result, v_current_server_rev
            );

            INSERT INTO public.sync_changes (
                user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
            ) VALUES (
                v_user_id, 'sleep_schedules', v_entity_id, v_operation, v_mutation_id, v_client_id, v_current_server_rev,
                v_record_data, v_item_hash
            );

            v_results := v_results || jsonb_build_array(v_item_result);

        ELSIF v_entity_type = 'user_settings' THEN
            SELECT * INTO v_existing_settings FROM public.user_settings WHERE user_id = v_user_id FOR UPDATE;

            IF FOUND AND v_existing_settings.server_rev > v_base_rev THEN
                v_item_result := jsonb_build_object(
                    'status', 'conflict',
                    'mutationId', v_mutation_id,
                    'conflictType', 'version_mismatch',
                    'baseServerRev', v_base_rev,
                    'currentServerRev', v_existing_settings.server_rev
                );

                INSERT INTO public.mutation_receipts (
                    user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
                ) VALUES (
                    v_user_id, v_mutation_id, v_item_hash, 'rejected_conflict', v_item_result, NULL
                );

                v_results := v_results || jsonb_build_array(v_item_result);
                CONTINUE;
            END IF;

            v_current_server_rev := v_current_server_rev + 1;

            INSERT INTO public.user_settings (
                user_id, settings, server_rev, updated_at
            ) VALUES (
                v_user_id,
                COALESCE(v_record_data->'settings', v_record_data, '{}'::jsonb),
                v_current_server_rev,
                pg_catalog.clock_timestamp()
            )
            ON CONFLICT (user_id) DO UPDATE
            SET settings = user_settings.settings || EXCLUDED.settings,
                server_rev = EXCLUDED.server_rev,
                updated_at = EXCLUDED.updated_at;

            v_item_result := jsonb_build_object('status', 'applied', 'mutationId', v_mutation_id, 'serverRev', v_current_server_rev);

            INSERT INTO public.mutation_receipts (
                user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
            ) VALUES (
                v_user_id, v_mutation_id, v_item_hash, 'applied', v_item_result, v_current_server_rev
            );

            INSERT INTO public.sync_changes (
                user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
            ) VALUES (
                v_user_id, 'user_settings', v_user_id, v_operation, v_mutation_id, v_client_id, v_current_server_rev,
                v_record_data, v_item_hash
            );

            v_results := v_results || jsonb_build_array(v_item_result);

        ELSIF v_entity_type = 'soundscape_presets' THEN
            SELECT * INTO v_existing_preset FROM public.soundscape_presets WHERE id = v_entity_id AND user_id = v_user_id FOR UPDATE;

            IF FOUND AND v_existing_preset.server_rev > v_base_rev THEN
                v_item_result := jsonb_build_object(
                    'status', 'conflict',
                    'mutationId', v_mutation_id,
                    'conflictType', 'version_mismatch',
                    'baseServerRev', v_base_rev,
                    'currentServerRev', v_existing_preset.server_rev
                );

                INSERT INTO public.mutation_receipts (
                    user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
                ) VALUES (
                    v_user_id, v_mutation_id, v_item_hash, 'rejected_conflict', v_item_result, NULL
                );

                v_results := v_results || jsonb_build_array(v_item_result);
                CONTINUE;
            END IF;

            v_current_server_rev := v_current_server_rev + 1;

            IF v_operation = 'INSERT' THEN
                INSERT INTO public.soundscape_presets (
                    id, user_id, name, channels, server_rev, created_at, updated_at
                ) VALUES (
                    v_entity_id, v_user_id,
                    COALESCE(v_record_data->>'name', 'Custom Preset'),
                    COALESCE(v_record_data->'channels', '[]'::jsonb),
                    v_current_server_rev,
                    pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
                )
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name,
                    channels = EXCLUDED.channels,
                    deleted_at = NULL,
                    server_rev = EXCLUDED.server_rev,
                    updated_at = EXCLUDED.updated_at;
            ELSIF v_operation = 'UPDATE' THEN
                UPDATE public.soundscape_presets
                SET name = COALESCE(v_record_data->>'name', name),
                    channels = COALESCE(v_record_data->'channels', channels),
                    server_rev = v_current_server_rev,
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_entity_id AND user_id = v_user_id;
            ELSIF v_operation = 'DELETE' THEN
                UPDATE public.soundscape_presets
                SET deleted_at = pg_catalog.clock_timestamp(),
                    server_rev = v_current_server_rev,
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_entity_id AND user_id = v_user_id;
            END IF;

            v_item_result := jsonb_build_object('status', 'applied', 'mutationId', v_mutation_id, 'serverRev', v_current_server_rev);

            INSERT INTO public.mutation_receipts (
                user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
            ) VALUES (
                v_user_id, v_mutation_id, v_item_hash, 'applied', v_item_result, v_current_server_rev
            );

            INSERT INTO public.sync_changes (
                user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
            ) VALUES (
                v_user_id, 'soundscape_presets', v_entity_id, v_operation, v_mutation_id, v_client_id, v_current_server_rev,
                v_record_data, v_item_hash
            );

            v_results := v_results || jsonb_build_array(v_item_result);

        ELSIF v_entity_type = 'sleep_prep_activities' THEN
            SELECT * INTO v_existing_activity FROM public.sleep_prep_activities WHERE id = v_entity_id AND user_id = v_user_id FOR UPDATE;

            IF FOUND AND v_existing_activity.server_rev > v_base_rev THEN
                v_item_result := jsonb_build_object(
                    'status', 'conflict',
                    'mutationId', v_mutation_id,
                    'conflictType', 'version_mismatch',
                    'baseServerRev', v_base_rev,
                    'currentServerRev', v_existing_activity.server_rev
                );

                INSERT INTO public.mutation_receipts (
                    user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
                ) VALUES (
                    v_user_id, v_mutation_id, v_item_hash, 'rejected_conflict', v_item_result, NULL
                );

                v_results := v_results || jsonb_build_array(v_item_result);
                CONTINUE;
            END IF;

            -- Prevent deletion of built-in activities
            IF v_operation = 'DELETE' AND FOUND AND v_existing_activity.is_builtin THEN
                v_item_result := jsonb_build_object(
                    'status', 'rejected',
                    'mutationId', v_mutation_id,
                    'reason', 'cannot_delete_builtin_activity'
                );

                INSERT INTO public.mutation_receipts (
                    user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
                ) VALUES (
                    v_user_id, v_mutation_id, v_item_hash, 'rejected_forbidden', v_item_result, NULL
                );

                v_results := v_results || jsonb_build_array(v_item_result);
                CONTINUE;
            END IF;

            v_current_server_rev := v_current_server_rev + 1;

            IF v_operation = 'INSERT' THEN
                INSERT INTO public.sleep_prep_activities (
                    id, user_id, title, description, order_index, is_builtin, server_rev, created_at, updated_at
                ) VALUES (
                    v_entity_id, v_user_id,
                    COALESCE(v_record_data->>'title', 'Activity'),
                    v_record_data->>'description',
                    COALESCE((v_record_data->>'order_index')::int, (v_record_data->>'orderIndex')::int, 0),
                    COALESCE((v_record_data->>'is_builtin')::boolean, (v_record_data->>'isBuiltin')::boolean, false),
                    v_current_server_rev,
                    pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
                )
                ON CONFLICT (id) DO UPDATE
                SET title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    order_index = EXCLUDED.order_index,
                    deleted_at = NULL,
                    server_rev = EXCLUDED.server_rev,
                    updated_at = EXCLUDED.updated_at;
            ELSIF v_operation = 'UPDATE' THEN
                UPDATE public.sleep_prep_activities
                SET title = COALESCE(v_record_data->>'title', title),
                    description = COALESCE(v_record_data->>'description', description),
                    order_index = COALESCE((v_record_data->>'order_index')::int, (v_record_data->>'orderIndex')::int, order_index),
                    server_rev = v_current_server_rev,
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_entity_id AND user_id = v_user_id;
            ELSIF v_operation = 'DELETE' THEN
                UPDATE public.sleep_prep_activities
                SET deleted_at = pg_catalog.clock_timestamp(),
                    server_rev = v_current_server_rev,
                    updated_at = pg_catalog.clock_timestamp()
                WHERE id = v_entity_id AND user_id = v_user_id;
            END IF;

            v_item_result := jsonb_build_object('status', 'applied', 'mutationId', v_mutation_id, 'serverRev', v_current_server_rev);

            INSERT INTO public.mutation_receipts (
                user_id, mutation_id, payload_hash, outcome_status, outcome_payload, server_rev
            ) VALUES (
                v_user_id, v_mutation_id, v_item_hash, 'applied', v_item_result, v_current_server_rev
            );

            INSERT INTO public.sync_changes (
                user_id, entity_type, entity_id, operation, mutation_id, client_id, server_rev, record_data, mutation_payload_hash
            ) VALUES (
                v_user_id, 'sleep_prep_activities', v_entity_id, v_operation, v_mutation_id, v_client_id, v_current_server_rev,
                v_record_data, v_item_hash
            );

            v_results := v_results || jsonb_build_array(v_item_result);

        ELSE
            RAISE EXCEPTION 'Unsupported entity type for batch sync: %', v_entity_type USING ERRCODE = '22023';
        END IF;
    END LOOP;

    -- Commit latest revision state if any mutations advanced revision
    IF v_current_server_rev > v_batch_base_rev THEN
        UPDATE public.user_sync_state
        SET last_server_rev = v_current_server_rev, updated_at = pg_catalog.clock_timestamp()
        WHERE user_id = v_user_id;
    END IF;

    RETURN jsonb_build_object('status', 'success', 'results', v_results);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 8. Ownership and Security Grants
ALTER FUNCTION public.canonical_hash_payload(JSONB) OWNER TO sync_admin_role;
ALTER FUNCTION public.get_sync_changes(BIGINT, BIGINT, BIGINT, INT) OWNER TO sync_admin_role;
ALTER FUNCTION public.update_sleep_prep_item(DATE, TEXT, TEXT, BIGINT, UUID, UUID) OWNER TO sync_admin_role;
ALTER FUNCTION public.start_active_sleep_session(UUID, DATE, TIMESTAMPTZ, INT, TEXT, UUID) OWNER TO sync_admin_role;
ALTER FUNCTION public.complete_active_sleep_session(UUID, TIMESTAMPTZ, TEXT, TEXT) OWNER TO sync_admin_role;
ALTER FUNCTION public.resolve_task_conflict(UUID, TEXT, JSONB, BIGINT, UUID, UUID) OWNER TO sync_admin_role;
ALTER FUNCTION public.sync_apply_batch(JSONB) OWNER TO sync_admin_role;

REVOKE ALL ON FUNCTION public.canonical_hash_payload(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_sync_changes(BIGINT, BIGINT, BIGINT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_sleep_prep_item(DATE, TEXT, TEXT, BIGINT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_active_sleep_session(UUID, DATE, TIMESTAMPTZ, INT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_active_sleep_session(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_task_conflict(UUID, TEXT, JSONB, BIGINT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_apply_batch(JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.canonical_hash_payload(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sync_changes(BIGINT, BIGINT, BIGINT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sleep_prep_item(DATE, TEXT, TEXT, BIGINT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_active_sleep_session(UUID, DATE, TIMESTAMPTZ, INT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_active_sleep_session(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_task_conflict(UUID, TEXT, JSONB, BIGINT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_apply_batch(JSONB) TO authenticated;
