begin;

-- Bootstrap the approved Admin model. AI Office remains disabled pending a separate policy/provider approval.
do $$
begin
  if not exists (select 1 from public.roles where code = 'system_admin') then
    raise exception 'Missing role system_admin';
  end if;
  if not exists (select 1 from public.roles where code = 'ban_giam_hieu') then
    raise exception 'Missing role ban_giam_hieu';
  end if;
  if not exists (select 1 from public.modules where code = 'reports') then
    raise exception 'Missing module reports';
  end if;
end
$$;

insert into public.role_permissions (role_id, module_id, action, data_scope)
select r.id, m.id, a.action, 'all'
from public.roles r
cross join public.modules m
cross join (values ('view'), ('create'), ('update'), ('delete'), ('approve'), ('import'), ('export')) as a(action)
where r.code = 'system_admin'
  and m.code <> 'ai_office'
on conflict (role_id, module_id, action)
do update set data_scope = excluded.data_scope, updated_at = now();

-- BGH can only view aggregate reports.
delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id and r.code = 'ban_giam_hieu';

insert into public.role_permissions (role_id, module_id, action, data_scope)
select r.id, m.id, 'view', 'all'
from public.roles r
join public.modules m on m.code = 'reports'
where r.code = 'ban_giam_hieu'
on conflict (role_id, module_id, action)
do update set data_scope = excluded.data_scope, updated_at = now();

-- Restrict configuration metadata to system administrators.
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
for select to authenticated
using (private.has_permission('system', 'view'));

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
for select to authenticated
using (private.has_permission('system', 'view'));

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
for select to authenticated
using (private.has_permission('system', 'view'));

-- Org units are visible only to system admins or users with a module permission scoped to that unit.
drop policy if exists org_units_select on public.org_units;
create policy org_units_select on public.org_units
for select to authenticated
using (
  private.has_permission('system', 'view')
  or private.has_permission('org', 'view', id)
  or private.has_permission('hr', 'view', id)
  or private.has_permission('admissions', 'view', id)
  or private.has_permission('students', 'view', id)
  or private.has_permission('training', 'view', id)
  or private.has_permission('teaching', 'view', id)
);

-- Role assignments are administration metadata; self authorization is provided by my_permissions().
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
for select to authenticated
using (private.has_permission('system', 'view'));

create or replace function private.apply_permission_change(
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
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

  if p_type in ('matrix_grant', 'matrix_revoke') then
    select id into v_role from public.roles where code = p_payload->>'role_code';
    select id into v_module from public.modules where code = p_payload->>'module_code';
    v_action := p_payload->>'action';
    v_scope := p_payload->>'data_scope';

    if v_role is null then raise exception 'unknown role code'; end if;
    if v_module is null then raise exception 'unknown module code'; end if;
    if p_payload->>'module_code' = 'ai_office' then
      raise exception 'AI Office permissions require separate approval';
    end if;
    if v_action is null or v_action not in ('view','create','update','delete','approve','import','export') then
      raise exception 'invalid action';
    end if;
    if v_scope is null or v_scope not in ('all','unit','own') then
      raise exception 'invalid data scope';
    end if;

    if p_type = 'matrix_grant' then
      insert into public.role_permissions (role_id, module_id, action, data_scope, created_by, updated_by)
      values (v_role, v_module, v_action, v_scope, (select auth.uid()), (select auth.uid()))
      on conflict (role_id, module_id, action)
      do update set data_scope = excluded.data_scope, updated_at = now(), updated_by = (select auth.uid());
    else
      delete from public.role_permissions
      where role_id = v_role and module_id = v_module and action = v_action and data_scope = v_scope;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then raise exception 'permission not found'; end if;
    end if;

  elsif p_type in ('role_assign', 'role_unassign') then
    select id into v_role from public.roles where code = p_payload->>'role_code';
    if v_role is null then raise exception 'unknown role code'; end if;
    v_user := nullif(p_payload->>'user_id', '')::uuid;
    v_unit := nullif(p_payload->>'org_unit_id', '')::uuid;
    if v_user is null then raise exception 'missing user id'; end if;
    if not exists (select 1 from public.profiles where id = v_user and status = 'active') then
      raise exception 'unknown or inactive user';
    end if;
    if v_unit is not null and not exists (select 1 from public.org_units where id = v_unit and is_active and deleted_at is null) then
      raise exception 'unknown or inactive organization unit';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user::text || ':' || v_role::text || ':' || coalesce(v_unit::text, '<null>'), 0)
    );

    if p_type = 'role_assign' then
      insert into public.user_roles (user_id, role_id, org_unit_id, created_by, updated_by)
      select v_user, v_role, v_unit, (select auth.uid()), (select auth.uid())
      where not exists (
        select 1 from public.user_roles ur
        where ur.user_id = v_user and ur.role_id = v_role
          and ur.org_unit_id is not distinct from v_unit
      );
    else
      delete from public.user_roles
      where user_id = v_user and role_id = v_role
        and org_unit_id is not distinct from v_unit;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then raise exception 'assignment not found'; end if;
    end if;
  else
    raise exception 'unknown change type';
  end if;
end
$function$;

create or replace function public.request_permission_change(
  p_type text,
  p_payload jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_user uuid;
  v_unit uuid;
  v_role_code text;
  v_module_code text;
  v_action text;
  v_scope text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not private.has_permission('system', 'update') then
    raise exception 'not allowed to request changes';
  end if;
  if p_type not in ('matrix_grant', 'matrix_revoke', 'role_assign', 'role_unassign') then
    raise exception 'unknown change type';
  end if;
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid permission change payload';
  end if;
  if length(pg_catalog.btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason is required (at least 10 characters)';
  end if;

  v_role_code := nullif(pg_catalog.btrim(p_payload->>'role_code'), '');
  if v_role_code is null or not exists (select 1 from public.roles where code = v_role_code) then
    raise exception 'unknown or missing role code';
  end if;

  if p_type in ('matrix_grant', 'matrix_revoke') then
    v_module_code := nullif(pg_catalog.btrim(p_payload->>'module_code'), '');
    v_action := p_payload->>'action';
    v_scope := p_payload->>'data_scope';
    if v_module_code is null or not exists (select 1 from public.modules where code = v_module_code) then
      raise exception 'unknown or missing module code';
    end if;
    if v_module_code = 'ai_office' then raise exception 'AI Office permissions require separate approval'; end if;
    if v_action is null or v_action not in ('view','create','update','delete','approve','import','export') then
      raise exception 'invalid action';
    end if;
    if v_scope is null or v_scope not in ('all','unit','own') then
      raise exception 'invalid data scope';
    end if;
  else
    v_user := nullif(p_payload->>'user_id', '')::uuid;
    v_unit := nullif(p_payload->>'org_unit_id', '')::uuid;
    if v_user is null then raise exception 'missing user id'; end if;
    if v_user = v_uid then raise exception 'cannot request a role change for yourself'; end if;
    if not exists (select 1 from public.profiles where id = v_user and status = 'active') then
      raise exception 'unknown or inactive user';
    end if;
    if v_unit is not null and not exists (select 1 from public.org_units where id = v_unit and is_active and deleted_at is null) then
      raise exception 'unknown or inactive organization unit';
    end if;
  end if;

  insert into public.permission_change_requests (change_type, payload, reason, requested_by)
  values (p_type, p_payload, pg_catalog.btrim(p_reason), v_uid)
  returning id into v_id;
  return v_id;
end
$function$;

create or replace function public.decide_permission_change(
  p_id uuid,
  p_approve boolean,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.permission_change_requests;
  v_uid uuid := (select auth.uid());
  v_target_role text;
  v_target_user uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not private.has_permission('system', 'approve') then
    raise exception 'not allowed to approve changes';
  end if;

  select * into r from public.permission_change_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if r.status <> 'pending' then raise exception 'request is not pending'; end if;
  if r.requested_by = v_uid then raise exception 'requester cannot decide own request'; end if;

  if p_approve then
    if r.change_type in ('matrix_grant', 'matrix_revoke') then
      v_target_role := r.payload->>'role_code';
      if exists (
        select 1 from public.user_roles ur
        join public.roles ro on ro.id = ur.role_id
        where ur.user_id = v_uid and ro.code = v_target_role
      ) then
        raise exception 'approver cannot approve permission changes to a role they hold';
      end if;
    elsif r.change_type in ('role_assign', 'role_unassign') then
      v_target_user := nullif(r.payload->>'user_id', '')::uuid;
      v_target_role := r.payload->>'role_code';
      if v_target_user = v_uid then
        raise exception 'approver cannot change own roles';
      end if;
      if exists (
        select 1 from public.user_roles ur
        join public.roles ro on ro.id = ur.role_id
        where ur.user_id = v_uid and ro.code = v_target_role
      ) then
        raise exception 'approver cannot approve assignments for a role they hold';
      end if;
    end if;

    perform private.apply_permission_change(r.change_type, r.payload);
    update public.permission_change_requests
    set status = 'applied', decided_by = v_uid, decided_at = now(), decision_note = p_note
    where id = p_id;
    return 'applied';
  else
    update public.permission_change_requests
    set status = 'rejected', decided_by = v_uid, decided_at = now(), decision_note = p_note
    where id = p_id;
    return 'rejected';
  end if;
end
$function$;

-- Reports expose aggregate counts only; no raw student/staff records are returned.
create or replace function public.reports_summary()
returns table (
  metric_code text,
  metric_label text,
  metric_value bigint,
  availability text,
  as_of timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.has_permission('reports', 'view') then
    raise exception 'not allowed to view reports' using errcode = '42501';
  end if;

  return query
  select 'active_org_units'::text, 'Đơn vị đang hoạt động'::text, count(*)::bigint, 'available'::text, now()
  from public.org_units where is_active = true and deleted_at is null
  union all
  select 'active_staff'::text, 'Nhân sự đang công tác'::text, count(*)::bigint, 'available'::text, now()
  from public.staff where status = 'active' and deleted_at is null
  union all
  select 'active_staff_assignments'::text, 'Phân công công tác đang hiệu lực'::text, count(*)::bigint, 'available'::text, now()
  from public.staff_assignments where status = 'active' and (end_date is null or end_date >= current_date)
  union all
  select 'active_students'::text, 'Người học đang học'::text, null::bigint, 'not_available'::text, now()
  union all
  select 'admissions'::text, 'Hồ sơ tuyển sinh'::text, null::bigint, 'not_available'::text, now()
  union all
  select 'training_results'::text, 'Kết quả đào tạo và điểm'::text, null::bigint, 'not_available'::text, now();
end
$function$;

revoke all on function public.request_permission_change(text, jsonb, text) from public, anon;
grant execute on function public.request_permission_change(text, jsonb, text) to authenticated;
revoke all on function public.decide_permission_change(uuid, boolean, text) from public, anon;
grant execute on function public.decide_permission_change(uuid, boolean, text) to authenticated;
revoke all on function public.reports_summary() from public, anon;
grant execute on function public.reports_summary() to authenticated;

commit;
