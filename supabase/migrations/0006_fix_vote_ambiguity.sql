-- =============================================================================
-- فاضي؟ — 0006 fix the vote-ambiguity crash
--
-- `set_suggestion_vote` declares `suggestion_id` as a RETURNS TABLE output
-- column, which shadowed the table column inside `on conflict (suggestion_id,
-- user_id)`. PL/pgSQL rejected that as ambiguous (42702), so EVERY vote failed
-- at runtime. A bare `on conflict do nothing` has no expression to resolve, and
-- the primary key still supplies VOT-004 idempotency.
--
-- 0003_rpc.sql already carries the corrected definition, so a fresh database
-- never sees the bug. This file exists so the repository mirrors the migration
-- history recorded against the live project, and because `create or replace`
-- makes re-application harmless.
-- =============================================================================

create or replace function public.set_suggestion_vote(p_suggestion uuid, p_selected boolean)
returns table (suggestion_id uuid, votes int, selected boolean)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  gid uuid; rid uuid; st public.suggestion_status; rst public.planning_round_status; m record;
begin
  select pr.group_id, pr.id, ps.status, pr.status into gid, rid, st, rst
  from public.plan_suggestions ps
  join public.planning_rounds pr on pr.id = ps.round_id
  where ps.id = p_suggestion;

  if gid is null or not public.is_active_member(gid) then raise exception 'NOT_FOUND'; end if;
  if rst <> 'open' or st <> 'active' then raise exception 'ROUND_CLOSED'; end if;

  if p_selected then
    insert into public.suggestion_votes (suggestion_id, user_id)
    values (p_suggestion, uid)
    on conflict do nothing;

    for m in select gm.user_id from public.group_members gm where gm.group_id = gid and gm.left_at is null
    loop
      perform public.push_notification(
        m.user_id, 'vote_activity', uid, gid, rid, '{}'::jsonb, 'vote_activity:' || rid::text
      );
    end loop;
  else
    delete from public.suggestion_votes v where v.suggestion_id = p_suggestion and v.user_id = uid;
  end if;

  suggestion_id := p_suggestion;
  votes := (
    select count(*)::int from public.suggestion_votes v
    join public.group_members gm on gm.user_id = v.user_id and gm.group_id = gid and gm.left_at is null
    where v.suggestion_id = p_suggestion
  );
  selected := exists (select 1 from public.suggestion_votes v where v.suggestion_id = p_suggestion and v.user_id = uid);
  return next;
end;
$$;

revoke execute on function public.set_suggestion_vote(uuid, boolean) from public, anon;
grant execute on function public.set_suggestion_vote(uuid, boolean) to authenticated;
