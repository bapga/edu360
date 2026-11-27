-- Keep the PostgREST RPC as SECURITY INVOKER; isolate the privileged implementation in the non-exposed private schema.
create or replace function private.publish_calendar_event_internal(p_event_id uuid, p_reason text)
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

revoke all on function private.publish_calendar_event_internal(uuid, text) from public, anon;
grant execute on function private.publish_calendar_event_internal(uuid, text) to authenticated;

create or replace function public.publish_calendar_event(p_event_id uuid, p_reason text)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.publish_calendar_event_internal(p_event_id, p_reason);
$function$;

revoke all on function public.publish_calendar_event(uuid, text) from public, anon;
grant execute on function public.publish_calendar_event(uuid, text) to authenticated;