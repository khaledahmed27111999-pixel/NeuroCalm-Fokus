# NeuroCalm & Fokus — Supabase Database Migrations

This directory contains the authoritative, offline SQL migration scripts for the NeuroCalm & Fokus cross-device synchronization infrastructure.

## Architecture Baseline

These migrations implement the approved **SYNC-0** architecture:
- **14 Normalized Tables:** Complete tenant isolation (`user_id = auth.uid()`), zero client data leakage.
- **RPC-Only Mutation Gateway:** Direct client writes are revoked from `authenticated`. All synchronized mutations execute through 6 transactional, row-locked stored procedures.
- **Decoupled Mutation Receipts:** Durable idempotency receipts in `public.mutation_receipts` tracking applied outcomes and rejected optimistic-concurrency collisions.
- **Deterministic Delta Replication:** Monotonic keyset-paginated change feed in `public.sync_changes` ordered by `(server_rev ASC, change_seq ASC)`.
- **Least-Privilege Security:** Functions run under `SECURITY DEFINER` owned by non-login role `sync_admin_role` with `SET search_path = ''` and `FORCE ROW LEVEL SECURITY`.

## Migration Sequence

1. `20261121000001_sync_core_schema.sql`
   - Creates `sync_admin_role`.
   - Provisions all 14 tables, primary keys, foreign keys, unique constraints, and indexes.
   - Enforces `FORCE ROW LEVEL SECURITY` across all tables.
   - Configures universal RLS policies (`TO authenticated, sync_admin_role`).
   - Revokes direct client writes on synchronized domain tables.

2. `20261121000002_sync_rpc_gateway.sql`
   - Provisions native SHA-256 payload canonicalization helper.
   - Implements the 6 transactional mutation and delta pagination functions:
     - `sync_apply_batch`
     - `get_sync_changes`
     - `update_sleep_prep_item`
     - `start_active_sleep_session`
     - `complete_active_sleep_session`
     - `resolve_task_conflict`
   - Transfers function ownership to `sync_admin_role`.
   - Configures scoped function execution grants.

## Operational Status (Phase SYNC-1A)

- **Execution Status:** OFFLINE PREPARATION ONLY.
- **Live Database Connection:** None. No migrations have been executed against any remote or live database.
- **Execution Plan:** Migrations will be applied in Phase SYNC-1B via Supabase CLI or project migration runner once cloud provisioning is authorized.
