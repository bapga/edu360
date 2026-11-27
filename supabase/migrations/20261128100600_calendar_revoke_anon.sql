-- Remove inherited anonymous table privileges; RLS remains enabled for authenticated access.
revoke all on table public.calendar_events from anon, public;
grant select, insert, update on table public.calendar_events to authenticated;