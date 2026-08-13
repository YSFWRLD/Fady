-- =============================================================================
-- فاضي؟ — 0005 function grant hardening
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, so after 0003
-- every security-definer function was reachable by the `anon` role through
-- /rest/v1/rpc/. Most would have failed on require_uid(), but the read-only
-- helpers leaked private facts to anyone holding a UUID — `active_member_count`
-- returned a group's member count outright, which contradicts BR-005 (authority
-- comes from active membership, never from possession of an id).
--
-- Caught by the Supabase security advisor:
--   anon_security_definer_function_executable (33)
--   authenticated_security_definer_function_executable (33)
-- =============================================================================

-- Unused by the application and the worst of the leaks.
drop function if exists public.active_member_count(uuid);

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

-- Helpers referenced inside RLS policy expressions. Policy predicates evaluate
-- as the calling role, so `authenticated` needs EXECUTE even though the client
-- never calls these directly.
grant execute on function public.is_active_member(uuid)    to authenticated;
grant execute on function public.is_group_admin(uuid)      to authenticated;
grant execute on function public.is_group_owner(uuid)      to authenticated;
grant execute on function public.round_group_id(uuid)      to authenticated;
grant execute on function public.suggestion_group_id(uuid) to authenticated;
grant execute on function public.plan_group_id(uuid)       to authenticated;

-- The §9.6 operation surface.
grant execute on function public.complete_profile(text, text, text) to authenticated;
grant execute on function public.search_users(text, int) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.rotate_group_invite(uuid) to authenticated;
grant execute on function public.redeem_group_invite(text) to authenticated;
grant execute on function public.change_member_role(uuid, uuid, public.group_role) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.replace_availability(uuid, jsonb, timestamptz, timestamptz) to authenticated;
grant execute on function public.open_planning_round(uuid, timestamptz, timestamptz, public.plan_category, text, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.add_suggestion(uuid, public.plan_category, text, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.withdraw_suggestion(uuid) to authenticated;
grant execute on function public.set_suggestion_vote(uuid, boolean) to authenticated;
grant execute on function public.close_planning_round(uuid, uuid) to authenticated;
grant execute on function public.cancel_planning_round(uuid) to authenticated;
grant execute on function public.respond_attendance(uuid, public.attendance_status) to authenticated;
grant execute on function public.cancel_confirmed_plan(uuid, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Server-side only: the hourly job (§9.9).
grant execute on function public.run_scheduled_jobs() to service_role;

-- Future functions must not inherit the PUBLIC default either.
alter default privileges in schema public revoke execute on functions from public;

comment on table public.friend_request_attempts is
  'Internal FRN cooldown bookkeeping. RLS enabled with no policy = deny all client access by design.';
