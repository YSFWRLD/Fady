-- =============================================================================
-- فاضي؟ — 0007 lock down direct client table writes
--
-- Security review finding (CONFIRMED). Supabase's platform bootstrap grants the
-- `anon` and `authenticated` roles blanket INSERT/UPDATE/DELETE on every public
-- table, with RLS as the only gate. Two UPDATE policies gate on row ownership
-- alone:
--
--   plan_suggestions_withdraw_own  — WITH CHECK (suggested_by = auth.uid())
--   plan_attendees_update_own      — WITH CHECK (user_id      = auth.uid())
--
-- A Postgres UPDATE ... WITH CHECK that names only the owner column lets the
-- caller rewrite EVERY other column, including foreign keys. So an authenticated
-- member could PATCH /rest/v1/plan_suggestions?id=eq.<own row> directly and:
--   • rewrite a suggestion's title/category/time/location/url AFTER others voted
--     (close_planning_round snapshots the edited row into confirmed_plans), and
--     move the times outside the round window that PLN-003 enforces in the RPC;
--   • repoint round_id to a round in a group they are NOT a member of — the
--     WITH CHECK never re-runs is_active_member — injecting a suggestion into a
--     foreign group's round.
-- The plan_attendees UPDATE policy has the same shape (lower impact).
--
-- Root-cause fix: the application performs exactly one direct client table write
-- (updateGroup → groups.name/image_path); every other mutation already goes
-- through a SECURITY DEFINER RPC, which runs as the table owner and bypasses
-- RLS. So we revoke all client DML and re-grant only that one narrow path. This
-- closes the whole class, not just the two flagged policies: clients can no
-- longer write any table directly except the intended group-edit columns.
-- =============================================================================

-- 1. Revoke blanket write access from both client roles on every current table.
revoke insert, update, delete, truncate, references
  on all tables in schema public
  from anon, authenticated;

-- 2. And on any table added later, so the default never silently re-opens.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references on tables from anon, authenticated;

-- 3. Re-grant the single legitimate direct write: updateGroup (GRP-004) patches
--    only the name and image. Column-scoped, so an admin still cannot rewrite
--    created_by (immutable attribution), timezone, or deleted_at. The
--    groups_update_admin policy remains the authorization gate.
grant update (name, image_path) on public.groups to authenticated;

-- 4. Drop the two now-inert, misleading write policies flagged by the review.
--    Withdrawal and RSVP already run through withdraw_suggestion /
--    respond_attendance (SECURITY DEFINER), which are unaffected by the revoke.
drop policy if exists plan_suggestions_withdraw_own on public.plan_suggestions;
drop policy if exists plan_attendees_update_own      on public.plan_attendees;

-- SELECT grants are deliberately left intact: reads go direct through PostgREST
-- under the caller's role, so the SELECT RLS policies remain the read boundary.
-- service_role keeps its own privileges (notification fan-out, cron) and is not
-- touched here.
