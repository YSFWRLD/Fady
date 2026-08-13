-- =============================================================================
-- فاضي؟ — 0008 adapt the scheduled job to a daily cron
--
-- Vercel Hobby plans permit only a daily cron, so /api/cron now runs once a day
-- instead of hourly (§9.9 assumed hourly). The reminder query looked for plans
-- starting in a 23-25 hour window, which is sized for hourly runs — on a daily
-- schedule that window is almost always empty and NO reminder would ever fire.
--
-- Widen it to "starts within the next 48 hours". The (user_id, dedupe_key)
-- unique index still guarantees exactly one reminder per attendee per plan, so
-- a plan is reminded on the first daily run that sees it: roughly 1-2 days
-- ahead rather than exactly 24 hours. The job stays idempotent and retry-safe.
--
-- Restoring the exact NOT-007 "24 hours before" behaviour needs an hourly cron,
-- which requires the Vercel Pro plan (or any external hourly scheduler hitting
-- /api/cron with the CRON_SECRET bearer token).
-- =============================================================================

create or replace function public.run_scheduled_jobs()
returns table (completed int, reminders int)
language plpgsql security definer set search_path = '' as $$
declare n_completed int := 0; n_reminders int := 0; r record;
begin
  -- 1. Plans whose end time has passed become completed.
  with done as (
    update public.confirmed_plans set status = 'completed'
      where status = 'scheduled' and end_at <= now() returning 1
  )
  select count(*)::int into n_completed from done;

  -- 2. One reminder per pending/going attendee who is still an active member.
  for r in
    select pa.user_id, cp.id as plan_id, cp.group_id, cp.category
    from public.confirmed_plans cp
    join public.plan_attendees pa on pa.confirmed_plan_id = cp.id
    join public.group_members gm on gm.group_id = cp.group_id and gm.user_id = pa.user_id and gm.left_at is null
    join public.groups g on g.id = cp.group_id and g.deleted_at is null
    where cp.status = 'scheduled' and pa.status in ('pending', 'going')
      and cp.start_at > now()
      and cp.start_at <= now() + interval '48 hours'
  loop
    insert into public.notifications (user_id, type, actor_id, group_id, entity_id, payload, dedupe_key)
    values (r.user_id, 'plan_reminder_24h', null, r.group_id, r.plan_id,
            jsonb_build_object('category', r.category), 'reminder24:' || r.plan_id::text)
    on conflict (user_id, dedupe_key) do nothing;
    n_reminders := n_reminders + 1;
  end loop;

  completed := n_completed; reminders := n_reminders;
  return next;
end;
$$;

revoke execute on function public.run_scheduled_jobs() from public, anon, authenticated;
grant execute on function public.run_scheduled_jobs() to service_role;
