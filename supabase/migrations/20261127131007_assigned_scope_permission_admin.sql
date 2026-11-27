create or replace function private.apply_permission_change(p_type text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role uuid;
  v_module uuid;
  v_user uuid;
  v_unit uuid;
  v_rows integer;
  v_action text;
  v_scope text;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid permission change payload';
  end if;
  if p_type in ('matrix_grant','matrix_revoke') then
    select id into v_role from public.roles where code = p_payload->>'role_code';
    select id into v_module from public.modules where code = p_payload->>'module_code';
    v_action := p_payload->>'action';
    v_scope := p_payload->>'data_scope';
    if v_role is null then raise exception 'unknown role code'; end if;
    if v_module is null then raise exception 'unknown module code'; end if;
    if p_payload->>'module_code' = 'ai_office' then raise exception 'AI Office permissions require separate approval'; end if;
    if v_action is null or v_action not in ('view','create','update','delete','approve','import','export') then raise exception 'invalid action'; end if;
    if v_scope is null or v_scope not in ('all','unit','own','assigned') then raise exception 'invalid data scope'; end if;
    if v_scope = 'assigned' and p_payload->>'module_code' not in ('teaching','grades') then raise exception 'assigned scope is only supported for teaching and grades'; end if;
    if p_type = 'matrix_grant' then
      insert into public.role_permissions(role_id,module_id,action,data_scope,created_by,updated_by)
      values(v_role,v_module,v_action,v_scope,(select auth.uid()),(select auth.uid()))
      on conflict(role_id,module_id,action) do update set data_scope=excluded.data_scope,updated_at=now(),updated_by=(select auth.uid());
    else
      delete from public.role_permissions where role_id=v_role and module_id=v_module and action=v_action and data_scope=v_scope;
      get diagnostics v_rows=row_count;
      if v_rows=0 then raise exception 'permission not found'; end if;
    end if;
  elsif p_type in ('role_assign','role_unassign') then
    select id into v_role from public.roles where code=p_payload->>'role_code';
    if v_role is null then raise exception 'unknown role code'; end if;
    v_user:=nullif(p_payload->>'user_id','')::uuid;
    v_unit:=nullif(p_payload->>'org_unit_id','')::uuid;
    if v_user is null then raise exception 'missing user id'; end if;
    if not exists(select 1 from public.profiles where id=v_user and status='active') then raise exception 'unknown or inactive user'; end if;
    if v_unit is not null and not exists(select 1 from public.org_units where id=v_unit and is_active and deleted_at is null) then raise exception 'unknown or inactive organization unit'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||v_role::text||':'||coalesce(v_unit::text,'<null>'),0));
    if p_type='role_assign' then
      insert into public.user_roles(user_id,role_id,org_unit_id,created_by,updated_by)
      select v_user,v_role,v_unit,(select auth.uid()),(select auth.uid())
      where not exists(select 1 from public.user_roles ur where ur.user_id=v_user and ur.role_id=v_role and ur.org_unit_id is not distinct from v_unit);
    else
      delete from public.user_roles where user_id=v_user and role_id=v_role and org_unit_id is not distinct from v_unit;
      get diagnostics v_rows=row_count;
      if v_rows=0 then raise exception 'assignment not found'; end if;
    end if;
  else
    raise exception 'unknown change type';
  end if;
end;
$function$;
