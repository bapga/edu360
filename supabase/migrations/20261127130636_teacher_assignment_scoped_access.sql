-- Teachers can work only with offerings to which they are actively assigned.
-- The assigned data scope is enforced by private.has_permission(..., p_owner := offering_id).

alter table public.role_permissions drop constraint if exists role_permissions_data_scope_check;
alter table public.role_permissions add constraint role_permissions_data_scope_check
  check (data_scope = any (array['all'::text,'unit'::text,'own'::text,'assigned'::text]));

create or replace function private.is_assigned_teacher(p_offering_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1 from public.teaching_assignments ta
    join public.staff s on s.id = ta.staff_id
    where ta.offering_id = p_offering_id
      and ta.status = 'active'
      and ta.assigned_from <= current_date
      and (ta.assigned_to is null or ta.assigned_to >= current_date)
      and s.user_id = (select auth.uid())
      and s.status = 'active'
      and s.deleted_at is null
  );
$function$;
revoke all on function private.is_assigned_teacher(uuid) from public, anon;
grant execute on function private.is_assigned_teacher(uuid) to authenticated;

create or replace function private.has_permission(
  p_module text, p_action text, p_unit uuid default null::uuid, p_owner uuid default null::uuid
)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles pr
    join public.user_roles ur on ur.user_id = pr.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.modules m on m.id = rp.module_id and m.code = p_module
    where pr.id = (select auth.uid()) and pr.status = 'active'
      and rp.action = p_action
      and (
        rp.data_scope = 'all'
        or (rp.data_scope = 'unit' and p_unit is not null and (
          ur.org_unit_id = p_unit
          or (ur.org_unit_id is null and p_unit in (
            select sa.org_unit_id from public.staff_assignments sa
            join public.staff s on s.id = sa.staff_id
            where s.user_id = (select auth.uid())
              and sa.status = 'active'
              and (sa.start_date is null or sa.start_date <= current_date)
              and (sa.end_date is null or sa.end_date >= current_date)
          ))
        ))
        or (rp.data_scope = 'own' and p_owner is not null and p_owner = (select auth.uid()))
        or (rp.data_scope = 'assigned' and p_owner is not null
          and p_module in ('teaching','grades')
          and private.is_assigned_teacher(p_owner))
      )
  );
$function$;
revoke all on function private.has_permission(text,text,uuid,uuid) from public, anon;
grant execute on function private.has_permission(text,text,uuid,uuid) to authenticated;

update public.role_permissions rp
set data_scope = 'assigned', updated_at = now()
from public.roles r, public.modules m
where rp.role_id = r.id and rp.module_id = m.id
  and r.code = 'giao_vien' and m.code in ('teaching','grades')
  and rp.action in ('view','create','update');

insert into public.role_permissions (role_id,module_id,action,data_scope)
select r.id,m.id,a.action,'assigned'
from public.roles r
cross join public.modules m
cross join (values ('view'),('create'),('update')) as a(action)
where r.code = 'giao_vien' and m.code in ('teaching','grades')
  and not exists (select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.module_id = m.id and rp.action = a.action);

drop policy if exists class_subject_offerings_select on public.class_subject_offerings;
create policy class_subject_offerings_select on public.class_subject_offerings
for select to authenticated
using (
  private.has_permission('training','view',org_unit_id)
  or private.has_permission('teaching','view',org_unit_id,id)
  or private.has_permission('grades','view',org_unit_id,id)
);

drop policy if exists teaching_assignments_select on public.teaching_assignments;
create policy teaching_assignments_select on public.teaching_assignments
for select to authenticated
using (private.has_permission('teaching','view',org_unit_id,offering_id));

drop policy if exists timetable_slots_select on public.timetable_slots;
create policy timetable_slots_select on public.timetable_slots
for select to authenticated
using (exists (select 1 from public.class_subject_offerings o
  where o.id = timetable_slots.offering_id
    and private.has_permission('teaching','view',o.org_unit_id,o.id)));

drop policy if exists attendance_sessions_read on public.attendance_sessions;
create policy attendance_sessions_read on public.attendance_sessions
for select to authenticated
using (exists (select 1 from public.class_subject_offerings o
  where o.id = attendance_sessions.offering_id
    and private.has_permission('teaching','view',o.org_unit_id,o.id)));

drop policy if exists attendance_sessions_insert on public.attendance_sessions;
create policy attendance_sessions_insert on public.attendance_sessions
for insert to authenticated
with check (status = 'draft' and created_by = (select auth.uid())
  and exists (select 1 from public.class_subject_offerings o
    where o.id = attendance_sessions.offering_id
      and private.has_permission('teaching','create',o.org_unit_id,o.id)));

drop policy if exists attendance_sessions_update on public.attendance_sessions;
create policy attendance_sessions_update on public.attendance_sessions
for update to authenticated
using (status in ('draft','open') and exists (
  select 1 from public.class_subject_offerings o where o.id = attendance_sessions.offering_id
    and private.has_permission('teaching','update',o.org_unit_id,o.id)))
with check (status in ('draft','open') and exists (
  select 1 from public.class_subject_offerings o where o.id = attendance_sessions.offering_id
    and private.has_permission('teaching','update',o.org_unit_id,o.id)));

drop policy if exists attendance_records_read on public.attendance_records;
create policy attendance_records_read on public.attendance_records
for select to authenticated
using (exists (select 1 from public.attendance_sessions s
  join public.class_subject_offerings o on o.id = s.offering_id
  where s.id = attendance_records.session_id
    and private.has_permission('teaching','view',o.org_unit_id,o.id)));

drop policy if exists attendance_records_insert on public.attendance_records;
create policy attendance_records_insert on public.attendance_records
for insert to authenticated
with check (marked_by = (select auth.uid()) and exists (
  select 1 from public.attendance_sessions s
  join public.class_subject_offerings o on o.id = s.offering_id
  where s.id = attendance_records.session_id and s.status in ('draft','open')
    and private.has_permission('teaching','create',o.org_unit_id,o.id)));

drop policy if exists attendance_records_update on public.attendance_records;
create policy attendance_records_update on public.attendance_records
for update to authenticated
using (exists (select 1 from public.attendance_sessions s
  join public.class_subject_offerings o on o.id = s.offering_id
  where s.id = attendance_records.session_id and s.status in ('draft','open')
    and private.has_permission('teaching','update',o.org_unit_id,o.id)))
with check (marked_by = (select auth.uid()) and exists (
  select 1 from public.attendance_sessions s
  join public.class_subject_offerings o on o.id = s.offering_id
  where s.id = attendance_records.session_id and s.status in ('draft','open')
    and private.has_permission('teaching','update',o.org_unit_id,o.id)));

drop policy if exists grade_sheets_read on public.grade_sheets;
create policy grade_sheets_read on public.grade_sheets
for select to authenticated
using (exists (select 1 from public.class_subject_offerings o
  where o.id = grade_sheets.offering_id
    and private.has_permission('grades','view',o.org_unit_id,o.id)));

drop policy if exists grade_sheets_insert on public.grade_sheets;
create policy grade_sheets_insert on public.grade_sheets
for insert to authenticated
with check (created_by = (select auth.uid()) and status = 'draft'
  and exists (select 1 from public.class_subject_offerings o
    where o.id = grade_sheets.offering_id
      and private.has_permission('grades','create',o.org_unit_id,o.id)));

drop policy if exists grade_sheets_update on public.grade_sheets;
create policy grade_sheets_update on public.grade_sheets
for update to authenticated
using (status in ('draft','reopened') and exists (
  select 1 from public.class_subject_offerings o where o.id = grade_sheets.offering_id
    and private.has_permission('grades','update',o.org_unit_id,o.id)))
with check (status in ('draft','reopened') and exists (
  select 1 from public.class_subject_offerings o where o.id = grade_sheets.offering_id
    and private.has_permission('grades','update',o.org_unit_id,o.id)));

drop policy if exists grade_components_read on public.grade_components;
create policy grade_components_read on public.grade_components
for select to authenticated
using (exists (select 1 from public.grade_sheets g
  join public.class_subject_offerings o on o.id = g.offering_id
  where g.id = grade_components.grade_sheet_id
    and private.has_permission('grades','view',o.org_unit_id,o.id)));

drop policy if exists grade_components_insert on public.grade_components;
create policy grade_components_insert on public.grade_components
for insert to authenticated
with check (exists (select 1 from public.grade_sheets g
  join public.class_subject_offerings o on o.id = g.offering_id
  where g.id = grade_components.grade_sheet_id and g.status in ('draft','reopened')
    and private.has_permission('grades','create',o.org_unit_id,o.id)));

drop policy if exists grade_components_update on public.grade_components;
create policy grade_components_update on public.grade_components
for update to authenticated
using (exists (select 1 from public.grade_sheets g
  join public.class_subject_offerings o on o.id = g.offering_id
  where g.id = grade_components.grade_sheet_id and g.status in ('draft','reopened')
    and private.has_permission('grades','update',o.org_unit_id,o.id)))
with check (exists (select 1 from public.grade_sheets g
  join public.class_subject_offerings o on o.id = g.offering_id
  where g.id = grade_components.grade_sheet_id and g.status in ('draft','reopened')
    and private.has_permission('grades','update',o.org_unit_id,o.id)));

drop policy if exists grade_entries_read on public.grade_entries;
create policy grade_entries_read on public.grade_entries
for select to authenticated
using (exists (select 1 from public.grade_sheets g
  join public.class_subject_offerings o on o.id = g.offering_id
  where g.id = grade_entries.grade_sheet_id
    and private.has_permission('grades','view',o.org_unit_id,o.id)));

drop policy if exists grade_entries_insert on public.grade_entries;
create policy grade_entries_insert on public.grade_entries
for insert to authenticated
with check (entered_by = (select auth.uid()) and exists (
  select 1 from public.grade_sheets g
  join public.class_subject_offerings o on o.id = g.offering_id
  where g.id = grade_entries.grade_sheet_id and g.status in ('draft','reopened')
    and private.has_permission('grades','create',o.org_unit_id,o.id)));

drop policy if exists grade_entries_update on public.grade_entries;
create policy grade_entries_update on public.grade_entries
for update to authenticated
using (exists (select 1 from public.grade_sheets g
  join public.class_subject_offerings o on o.id = g.offering_id
  where g.id = grade_entries.grade_sheet_id and g.status in ('draft','reopened')
    and private.has_permission('grades','update',o.org_unit_id,o.id)))
with check (updated_by = (select auth.uid()) and exists (
  select 1 from public.grade_sheets g
  join public.class_subject_offerings o on o.id = g.offering_id
  where g.id = grade_entries.grade_sheet_id and g.status in ('draft','reopened')
    and private.has_permission('grades','update',o.org_unit_id,o.id)));

create or replace function public.submit_attendance_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_session public.attendance_sessions;
  v_offering public.class_subject_offerings;
  v_expected integer;
  v_actual integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_session from public.attendance_sessions where id = p_session_id for update;
  if not found then raise exception 'attendance session not found'; end if;
  select * into v_offering from public.class_subject_offerings where id = v_session.offering_id;
  if not private.has_permission('teaching','update',v_offering.org_unit_id,v_offering.id)
     and not (v_session.created_by = v_uid and private.has_permission('teaching','create',v_offering.org_unit_id,v_offering.id)) then
    raise exception 'not allowed' using errcode='42501';
  end if;
  if v_session.status not in ('draft','open') then raise exception 'attendance session is not editable'; end if;
  select count(*) into v_expected from public.student_enrollments e
    where e.class_group_id = v_offering.class_group_id and e.status = 'studying';
  select count(*) into v_actual from public.attendance_records r where r.session_id = p_session_id;
  if v_expected = 0 or v_actual <> v_expected then
    raise exception 'attendance list incomplete: expected %, recorded %',v_expected,v_actual;
  end if;
  update public.attendance_sessions set status='submitted',submitted_by=v_uid,submitted_at=now(),updated_at=now()
    where id=p_session_id;
end;
$function$;

create or replace function public.submit_grade_sheet(p_grade_sheet_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_sheet public.grade_sheets;
  v_unit uuid;
  v_class uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_sheet from public.grade_sheets where id=p_grade_sheet_id for update;
  if not found then raise exception 'grade sheet not found'; end if;
  select o.org_unit_id,o.class_group_id into v_unit,v_class
    from public.class_subject_offerings o where o.id=v_sheet.offering_id;
  if not private.has_permission('grades','update',v_unit,v_sheet.offering_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;
  if v_sheet.status not in ('draft','reopened') then raise exception 'grade sheet is not editable'; end if;
  if not exists(select 1 from public.grade_components c where c.grade_sheet_id=p_grade_sheet_id) then
    raise exception 'grade sheet has no assessment components';
  end if;
  if exists (
    select 1 from public.grade_components c
    cross join public.student_enrollments e
    left join public.grade_entries ge on ge.grade_component_id=c.id
      and ge.student_enrollment_id=e.id and ge.grade_sheet_id=p_grade_sheet_id
    where c.grade_sheet_id=p_grade_sheet_id and e.class_group_id=v_class
      and e.status='studying' and ge.id is null
  ) then raise exception 'grade sheet is incomplete: some students have missing component scores'; end if;
  if exists (
    select 1 from public.grade_entries ge
    join public.grade_components c on c.id=ge.grade_component_id
    where ge.grade_sheet_id=p_grade_sheet_id
      and (ge.score is null or ge.score<0 or ge.score>c.max_score)
  ) then raise exception 'missing or out-of-range scores'; end if;
  update public.grade_sheets set status='submitted',submitted_by=v_uid,submitted_at=now(),updated_at=now()
    where id=p_grade_sheet_id;
end;
$function$;

revoke all on function public.submit_attendance_session(uuid) from public, anon;
grant execute on function public.submit_attendance_session(uuid) to authenticated;
revoke all on function public.submit_grade_sheet(uuid) from public, anon;
grant execute on function public.submit_grade_sheet(uuid) to authenticated;
