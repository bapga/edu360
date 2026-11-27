-- Calendar events: school-wide and unit work calendar, protected by tasks permissions.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null references public.org_units(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 240),
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_valid_time check (ends_at > starts_at)
);

create index if not exists calendar_events_unit_start_idx
  on public.calendar_events (org_unit_id, starts_at);
create index if not exists calendar_events_status_start_idx
  on public.calendar_events (status, starts_at);

alter table public.calendar_events enable row level security;

grant select, insert, update on public.calendar_events to authenticated;

drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select
  on public.calendar_events for select to authenticated
  using (private.has_permission('tasks', 'view', org_unit_id));

drop policy if exists calendar_events_insert on public.calendar_events;
create policy calendar_events_insert
  on public.calendar_events for insert to authenticated
  with check (
    status = 'draft'
    and created_by = (select auth.uid())
    and private.has_permission('tasks', 'create', org_unit_id)
  );

drop policy if exists calendar_events_update_draft on public.calendar_events;
create policy calendar_events_update_draft
  on public.calendar_events for update to authenticated
  using (
    status = 'draft'
    and private.has_permission('tasks', 'update', org_unit_id)
  )
  with check (
    status = 'draft'
    and created_by = (select auth.uid())
    and private.has_permission('tasks', 'update', org_unit_id)
  );

create or replace function private.touch_calendar_event_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists calendar_events_touch_updated_at on public.calendar_events;
create trigger calendar_events_touch_updated_at
before update on public.calendar_events
for each row execute function private.touch_calendar_event_updated_at();

create or replace function public.publish_calendar_event(p_event_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_unit_id uuid;
  v_status text;
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Publication reason must contain at least 10 characters';
  end if;

  select e.org_unit_id, e.status
    into v_unit_id, v_status
  from public.calendar_events e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'Calendar event not found';
  end if;
  if not private.has_permission('tasks', 'approve', v_unit_id) then
    raise exception 'Insufficient permission to publish calendar events';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only draft events can be published';
  end if;

  update public.calendar_events
    set status = 'published',
        published_by = v_actor,
        published_at = now()
  where id = p_event_id;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    v_actor,
    'calendar_event_published',
    'calendar_events',
    p_event_id::text,
    jsonb_build_object('status', v_status),
    jsonb_build_object('status', 'published', 'reason', btrim(p_reason))
  );

  return p_event_id;
end;
$function$;

revoke all on function public.publish_calendar_event(uuid, text) from public, anon;
grant execute on function public.publish_calendar_event(uuid, text) to authenticated;
