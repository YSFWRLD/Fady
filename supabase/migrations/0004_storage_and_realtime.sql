-- =============================================================================
-- فاضي؟ — 0004 storage buckets and realtime
-- PRD §9.4 (storage) and §9.8 (scoped realtime).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Buckets. Both are private; the app serves images through signed URLs so a
-- group image is never publicly addressable. §9.4: JPEG/PNG/WebP, 5 MB max.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',      'avatars',      false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('group-images', 'group-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

-- ---------------------------------------------------------------------------
-- avatars: authenticated-readable, owner-writable. Object paths start with the
-- owner's UUID, and the app appends a random filename so the original name is
-- never stored.
-- ---------------------------------------------------------------------------
create policy avatars_read_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- group-images: readable only by active members of that group; writable by
-- owner/admin. The first path segment is the group UUID.
-- ---------------------------------------------------------------------------
create policy group_images_read_members on storage.objects
  for select to authenticated
  using (
    bucket_id = 'group-images'
    and public.is_active_member(((storage.foldername(name))[1])::uuid)
  );

create policy group_images_write_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'group-images'
    and public.is_group_admin(((storage.foldername(name))[1])::uuid)
  );

create policy group_images_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'group-images' and public.is_group_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'group-images' and public.is_group_admin(((storage.foldername(name))[1])::uuid));

create policy group_images_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'group-images' and public.is_group_admin(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- Realtime — §9.8. The client subscribes only while the relevant surface is
-- visible, and every payload triggers an authorized re-fetch rather than being
-- trusted on its own. RLS still applies to realtime reads.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.availability_slots;
alter publication supabase_realtime add table public.plan_suggestions;
alter publication supabase_realtime add table public.suggestion_votes;
alter publication supabase_realtime add table public.planning_rounds;
alter publication supabase_realtime add table public.confirmed_plans;
alter publication supabase_realtime add table public.plan_attendees;
alter publication supabase_realtime add table public.notifications;
