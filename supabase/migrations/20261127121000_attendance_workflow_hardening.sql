begin;

create or replace function private.validate_attendance_record()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
 v_class uuid;
 v_enrollment_class uuid;
 v_planned_periods numeric;
begin
 select o.class_group_id,s.planned_periods
 into v_class,v_planned_periods
 from public.attendance_sessions s
 join public.class_subject_offerings o on o.id=s.offering_id
 where s.id=new.session_id;
 select e.class_group_id into v_enrollment_class
 from public.student_enrollments e
 where e.id=new.student_enrollment_id and e.status='studying';
 if v_class is null or v_enrollment_class is distinct from v_class then
  raise exception 'student enrollment does not belong to attendance class';
 end if;
 if new.periods_absent > v_planned_periods then
  raise exception 'absent periods exceed planned periods';
 end if;
 return new;
end;
$function$;

create or replace function private.validate_grade_entry()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
 v_sheet uuid;
 v_class uuid;
 v_enrollment_class uuid;
 v_max numeric;
begin
 select c.grade_sheet_id,c.max_score into v_sheet,v_max
 from public.grade_components c where c.id=new.grade_component_id;
 if v_sheet is distinct from new.grade_sheet_id then
  raise exception 'grade component does not belong to grade sheet';
 end if;
 if new.score is not null and (new.score<0 or new.score>v_max) then
  raise exception 'score is outside the allowed range';
 end if;
 select o.class_group_id into v_class
 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id
 where g.id=new.grade_sheet_id;
 select e.class_group_id into v_enrollment_class
 from public.student_enrollments e
 where e.id=new.student_enrollment_id and e.status='studying';
 if v_class is null or v_enrollment_class is distinct from v_class then
  raise exception 'student enrollment does not belong to grade sheet class';
 end if;
 return new;
end;
$function$;

create or replace function private.validate_attendance_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_offering public.class_subject_offerings;
 v_term public.academic_terms;
 v_slot public.timetable_slots;
begin
 select * into v_offering from public.class_subject_offerings where id=new.offering_id;
 if not found or v_offering.status not in ('planned','open') then
  raise exception 'offering is not available for attendance';
 end if;
 select t.* into v_term
 from public.academic_terms t where t.id=v_offering.academic_term_id;
 if new.session_date < v_term.starts_on or new.session_date > v_term.ends_on then
  raise exception 'attendance date must be inside the academic term';
 end if;
 if new.timetable_slot_id is not null then
  select * into v_slot from public.timetable_slots where id=new.timetable_slot_id;
  if not found or v_slot.offering_id<>new.offering_id or v_slot.status<>'published' then
   raise exception 'timetable slot must be a published slot of this offering';
  end if;
 end if;
 if tg_op='INSERT' and new.status<>'draft' then
  raise exception 'new attendance sessions must start as draft';
 end if;
 return new;
end;
$function$;

drop trigger if exists attendance_session_integrity on public.attendance_sessions;
create trigger attendance_session_integrity
before insert or update on public.attendance_sessions
for each row execute function private.validate_attendance_session();

drop policy if exists attendance_sessions_insert on public.attendance_sessions;
create policy attendance_sessions_insert on public.attendance_sessions
for insert to authenticated
with check (
 status='draft' and created_by=auth.uid()
 and exists(select 1 from public.class_subject_offerings o
  where o.id=offering_id and private.has_permission('teaching','create',o.org_unit_id))
);

create or replace function public.get_offering_roster(p_offering_id uuid)
returns table(
 enrollment_id uuid,
 student_id uuid,
 student_code text,
 full_name text,
 enrollment_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare v_unit uuid; v_class uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select o.org_unit_id,o.class_group_id into v_unit,v_class
 from public.class_subject_offerings o where o.id=p_offering_id;
 if not found then raise exception 'offering not found'; end if;
 if not private.has_permission('teaching','view',v_unit)
  and not private.has_permission('grades','view',v_unit)
  and not exists(
   select 1 from public.teaching_assignments a
   join public.staff s on s.id=a.staff_id
   where a.offering_id=p_offering_id and a.status='active'
    and s.user_id=auth.uid()
    and a.assigned_from<=current_date
    and (a.assigned_to is null or a.assigned_to>=current_date)
  ) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 return query
 select e.id,s.id,s.student_code,s.full_name,e.status
 from public.student_enrollments e
 join public.students s on s.id=e.student_id
 where e.class_group_id=v_class and e.status='studying' and s.status='active'
 order by s.student_code;
end;
$function$;

create or replace function public.submit_attendance_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_session public.attendance_sessions;
 v_offering public.class_subject_offerings;
 v_expected integer;
 v_actual integer;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_session from public.attendance_sessions where id=p_session_id for update;
 if not found then raise exception 'attendance session not found'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_session.offering_id;
 if not private.has_permission('teaching','update',v_offering.org_unit_id)
  and not (v_session.created_by=v_uid and private.has_permission('teaching','create',v_offering.org_unit_id)) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_session.status not in ('draft','open') then raise exception 'attendance session is not editable'; end if;
 select count(*) into v_expected from public.student_enrollments e
 where e.class_group_id=v_offering.class_group_id and e.status='studying';
 select count(*) into v_actual from public.attendance_records r where r.session_id=p_session_id;
 if v_expected=0 or v_actual<>v_expected then
  raise exception 'attendance list incomplete: expected %, recorded %',v_expected,v_actual;
 end if;
 update public.attendance_sessions
 set status='submitted',submitted_by=v_uid,submitted_at=now(),updated_at=now()
 where id=p_session_id;
end;
$function$;

create or replace function public.decide_attendance_session(
 p_session_id uuid,
 p_approve boolean,
 p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_session public.attendance_sessions;
 v_offering public.class_subject_offerings;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_session from public.attendance_sessions where id=p_session_id for update;
 if not found then raise exception 'attendance session not found'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_session.offering_id;
 if not private.has_permission('teaching','approve',v_offering.org_unit_id) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_session.status<>'submitted' then raise exception 'attendance session is not awaiting approval'; end if;
 if v_session.submitted_by=v_uid then raise exception 'submitter cannot approve own attendance session' using errcode='42501'; end if;
 update public.attendance_sessions
 set status=case when p_approve then 'approved' else 'open' end,
  approved_by=case when p_approve then v_uid else null end,
  approved_at=case when p_approve then now() else null end,
  note=case when coalesce(p_note,'')='' then note else left(p_note,2000) end,
  updated_at=now()
 where id=p_session_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,case when p_approve then 'approve_attendance' else 'return_attendance' end,
  'attendance_sessions',p_session_id::text,
  jsonb_build_object('note',left(coalesce(p_note,''),2000),'offering_id',v_offering.id));
end;
$function$;

create or replace function public.submit_grade_sheet(p_grade_sheet_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_sheet public.grade_sheets;
 v_unit uuid;
 v_class uuid;
 v_weight numeric;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_sheet from public.grade_sheets where id=p_grade_sheet_id for update;
 if not found then raise exception 'grade sheet not found'; end if;
 select o.org_unit_id,o.class_group_id into v_unit,v_class
 from public.class_subject_offerings o where o.id=v_sheet.offering_id;
 if not private.has_permission('grades','update',v_unit) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_sheet.status not in ('draft','reopened') then raise exception 'grade sheet is not editable'; end if;
 select coalesce(sum(weight),0) into v_weight
 from public.grade_components where grade_sheet_id=p_grade_sheet_id;
 if abs(v_weight-1)>0.0001 then raise exception 'component weights must total 100 percent'; end if;
 if not exists(select 1 from public.student_enrollments e where e.class_group_id=v_class and e.status='studying') then
  raise exception 'class has no active student enrollments';
 end if;
 if not exists(select 1 from public.grade_components c where c.grade_sheet_id=p_grade_sheet_id) then
  raise exception 'grade sheet has no assessment components';
 end if;
 if exists(
  select 1 from public.grade_components c
  cross join public.student_enrollments e
  left join public.grade_entries ge
   on ge.grade_component_id=c.id and ge.student_enrollment_id=e.id and ge.grade_sheet_id=p_grade_sheet_id
  where c.grade_sheet_id=p_grade_sheet_id and e.class_group_id=v_class and e.status='studying'
   and ge.id is null
 ) then raise exception 'grade sheet is incomplete: some students have missing component scores'; end if;
 if exists(
  select 1 from public.grade_entries e
  join public.grade_components c on c.id=e.grade_component_id
  where e.grade_sheet_id=p_grade_sheet_id and (e.score is null or e.score<0 or e.score>c.max_score)
 ) then raise exception 'missing or out-of-range scores'; end if;
 update public.grade_sheets
 set status='submitted',submitted_by=v_uid,submitted_at=now(),updated_at=now()
 where id=p_grade_sheet_id;
end;
$function$;

create or replace function public.return_grade_sheet(p_grade_sheet_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v_uid uuid := (select auth.uid()); v_sheet public.grade_sheets; v_unit uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'return reason must contain at least 10 characters'; end if;
 select * into v_sheet from public.grade_sheets where id=p_grade_sheet_id for update;
 if not found then raise exception 'grade sheet not found'; end if;
 select org_unit_id into v_unit from public.class_subject_offerings where id=v_sheet.offering_id;
 if not private.has_permission('grades','approve',v_unit) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_sheet.status<>'submitted' then raise exception 'only submitted grade sheets can be returned'; end if;
 if v_sheet.submitted_by=v_uid then raise exception 'submitter cannot return own grade sheet'; end if;
 update public.grade_sheets set status='reopened',approved_by=null,approved_at=null,updated_at=now() where id=p_grade_sheet_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,'return_grade_sheet','grade_sheets',p_grade_sheet_id::text,jsonb_build_object('reason',btrim(p_reason)));
end;
$function$;

create or replace function public.reopen_grade_sheet(p_grade_sheet_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v_uid uuid := (select auth.uid()); v_sheet public.grade_sheets; v_unit uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'reopen reason must contain at least 10 characters'; end if;
 select * into v_sheet from public.grade_sheets where id=p_grade_sheet_id for update;
 if not found then raise exception 'grade sheet not found'; end if;
 select org_unit_id into v_unit from public.class_subject_offerings where id=v_sheet.offering_id;
 if not private.has_permission('grades','approve',v_unit) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_sheet.status<>'locked' then raise exception 'only locked grade sheets can be reopened'; end if;
 update public.grade_sheets set status='reopened',updated_at=now() where id=p_grade_sheet_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,old_data,new_data)
 values(v_uid,'reopen_grade_sheet','grade_sheets',p_grade_sheet_id::text,
  jsonb_build_object('status','locked'),jsonb_build_object('status','reopened','reason',btrim(p_reason)));
end;
$function$;

revoke all on function public.get_offering_roster(uuid) from public,anon;
revoke all on function public.submit_attendance_session(uuid) from public,anon;
revoke all on function public.decide_attendance_session(uuid,boolean,text) from public,anon;
revoke all on function public.submit_grade_sheet(uuid) from public,anon;
revoke all on function public.return_grade_sheet(uuid,text) from public,anon;
revoke all on function public.reopen_grade_sheet(uuid,text) from public,anon;
grant execute on function public.get_offering_roster(uuid) to authenticated;
grant execute on function public.submit_attendance_session(uuid) to authenticated;
grant execute on function public.decide_attendance_session(uuid,boolean,text) to authenticated;
grant execute on function public.submit_grade_sheet(uuid) to authenticated;
grant execute on function public.return_grade_sheet(uuid,text) to authenticated;
grant execute on function public.reopen_grade_sheet(uuid,text) to authenticated;

commit;
