-- =============================================================================
-- فاضي؟ — 0009 let the location field hold a map link
--
-- The suggestion form now accepts either a pasted Google Maps link or a plain
-- place name (a name is turned into a Maps search URL at render time). Map URLs
-- routinely exceed the original 120-character cap, so raise it to the same 2048
-- ceiling external_url already uses.
-- =============================================================================

alter table public.plan_suggestions drop constraint if exists suggestion_location_len;
alter table public.plan_suggestions
  add constraint suggestion_location_len
  check (location is null or char_length(location) <= 2048);
