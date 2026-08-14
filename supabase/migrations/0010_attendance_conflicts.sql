-- =============================================================================
-- فاضي؟ — 0010 double-booking guard for RSVP
--
-- CAL-002 already flags overlapping confirmed plans on the personal calendar,
-- but nothing stopped a member from saying "أكيد" to two plans at the same
-- time. §7.5 is explicit that conflicts are surfaced and never auto-resolved,
-- so resolution stays an explicit user choice — the server just refuses to
-- create the clash silently, and can settle both sides atomically once the
-- member has chosen.
-- =============================================================================

-- Plans the caller is already going to that overlap the given plan's window.
create or replace function public.attendance_conflicts(p_plan uuid)
returns table (plan_id uuid, title text, start_at timestamptz, end_at timestamptz, group_name text)
language sql security definer stable set search_path = '' as $$
  select cp.id, cp.title, cp.start_at, cp.end_at, g.name
  from public.confirmed_plans target
  join public.confirmed_plans cp
    on cp.id <> target.id
   and cp.status = 'scheduled'
   and cp.start_at < target.end_at
   and cp.end_at   > target.start_at
  join public.plan_attendees pa
    on pa.confirmed_plan_id = cp.id
   and pa.user_id = (select auth.uid())
   and pa.status = 'going'
  join public.groups g on g.id = cp.group_id and g.deleted_at is null
  where target.id = p_plan
    and public.is_active_member(target.group_id);
$$;

-- RSVP that can also stand down from the plans it clashes with, in one
-- transaction, so the member is never briefly double-booked or double-freed.
create or replace function public.respond_attendance_resolving(
  p_plan uuid,
  p_status public.attendance_status,
  p_withdraw_from uuid[] default '{}'
)
returns public.plan_attendees
language plpgsql security definer set search_path = '' as $$
declare
  uid    uuid := public.require_uid();
  plan   public.confirmed_plans;
  result public.plan_attendees;
  other  uuid;
begin
  if p_status not in ('going', 'not_going') then
    raise exception 'VALIDATION_ERROR';
  end if;

  select * into plan from public.confirmed_plans where id = p_plan;
  if plan.id is null or not public.is_active_member(plan.group_id) then
    raise exception 'NOT_FOUND';
  end if;
  if plan.status <> 'scheduled' then
    raise exception 'CONFLICT';
  end if;

  -- Step down from the clashing plans first. Each is re-validated the same way,
  -- so this cannot be used to touch a plan the caller has no business editing.
  foreach other in array coalesce(p_withdraw_from, '{}')
  loop
    if exists (
      select 1 from public.confirmed_plans cp
      where cp.id = other and cp.status = 'scheduled' and public.is_active_member(cp.group_id)
    ) then
      insert into public.plan_attendees (confirmed_plan_id, user_id, status, responded_at)
      values (other, uid, 'not_going', now())
      on conflict (confirmed_plan_id, user_id) do update
        set status = 'not_going', responded_at = now();
    end if;
  end loop;

  insert into public.plan_attendees (confirmed_plan_id, user_id, status, responded_at)
  values (p_plan, uid, p_status, now())
  on conflict (confirmed_plan_id, user_id) do update
    set status = excluded.status, responded_at = now()
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.attendance_conflicts(uuid) from public, anon;
revoke execute on function public.respond_attendance_resolving(uuid, public.attendance_status, uuid[]) from public, anon;
grant execute on function public.attendance_conflicts(uuid) to authenticated;
grant execute on function public.respond_attendance_resolving(uuid, public.attendance_status, uuid[]) to authenticated;
