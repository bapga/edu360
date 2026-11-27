begin;

create table public.attendance_sessions (
 id uuid primary key default gen_random_uuid(),
 offering_id uuid not null references public.class_subject_offerings(id),
 session_date date not null,
 period_start smallint not null check(period_start > 0),
 period_end smallint not null check(period_end >= period_start),
 topic text,
 status text not null default 'draft' check(status in ('draft','submitted','approved','returned','cancelled')),
 created_by uuid not null default auth.uid() references auth.users(id),
 submitted_by uuid references auth.users(id),
 submitted_at timestamptz,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 decision_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(offering_id,session_date,period_start)
);

create table public.attendance_records (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.attendance_sessions(id),
 enrollment_id uuid not null references public.student_enrollments(id),
 attendance_status text not null default 'present' check(attendance_status in ('present','absent','late','excused')),
 minutes_late integer check(minutes_late is null or minutes_late between 1 and 1440),
 note text,
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(session_id,enrollment_id)
);

create table public.gradebooks (
 id uuid primary key default gen_random_uuid(),
 offering_id uuid not null unique references public.class_subject_offerings(id),
 status text not null default 'draft' check(status in ('draft','submitted','approved','returned','locked')),
 created_by uuid not null default auth.uid() references auth.users(id),
 submitted_by uuid references auth.users(id),
 submitted_at timestamptz,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 locked_by uuid references auth.users(id),
 locked_at timestamptz,
 decision_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.grade_components (
 id uuid primary key default gen_random_uuid(),
 gradebook_id uuid not null references public.gradebooks(id),
 code text not null,
 name text not null,
 category text not null check(category in ('regular','midterm','final','practice','internship','other')),
 weight numeric(5,2) not null check(weight > 0 and weight <= 100),
 max_score numeric(6,2) not null default 10 check(max_score > 0 and max_score <= 1000),
 assessment_date date,
 is_required boolean not null default true,
 sort_order integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(gradebook_id,code)
);

create table public.grade_entries (
 id uuid primary key default gen_random_uuid(),
 component_id uuid not null references public.grade_components(id),
 enrollment_id uuid not null references public.student_enrollments(id),
 score numeric(6,2) not null check(score >= 0),
 note text,
 entered_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(component_id,enrollment_id)
);

create index attendance_sessions_offering_date_idx on public.attendance_sessions(offering_id,session_date,status);
create index attendance_records_enrollment_idx on public.attendance_records(enrollment_id,session_id);
create index gradebooks_offering_status_idx on public.gradebooks(offering_id,status);
create index grade_components_gradebook_idx on public.grade_components(gradebook_id,sort_order);
create index grade_entries_enrollment_idx on public.grade_entries(enrollment_id,component_id);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.gradebooks enable row level security;
alter table public.grade_components enable row level security;
alter table public.grade_entries enable row level security;

create policy attendance_sessions_select on public.attendance_sessions
 for select to authenticated using (
  exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','view',o.org_unit_id))
  or exists(select 1 from public.teaching_assignments a join public.staff s on s.id=a.staff_id
    where a.offering_id=attendance_sessions.offering_id and a.status='active' and s.user_id=auth.uid())
 );
create policy attendance_sessions_insert on public.attendance_sessions
 for insert to authenticated with check (
  status='draft' and created_by=auth.uid()
  and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','create',o.org_unit_id))
 );
create policy attendance_sessions_update on public.attendance_sessions
 for update to authenticated using (
  status in ('draft','returned')
  and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and (private.has_permission('teaching','update',o.org_unit_id) or (created_by=auth.uid() and private.has_permission('teaching','create',o.org_unit_id))))
 ) with check (
  status in ('draft','returned') and created_by=attendance_sessions.created_by
  and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and (private.has_permission('teaching','update',o.org_unit_id) or (created_by=auth.uid() and private.has_permission('teaching','create',o.org_unit_id))))
 );

create policy attendance_records_select on public.attendance_records
 for select to authenticated using (
  exists(select 1 from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id
   where s.id=session_id and (private.has_permission('teaching','view',o.org_unit_id)
    or exists(select 1 from public.teaching_assignments a join public.staff st on st.id=a.staff_id
      where a.offering_id=o.id and a.status='active' and st.user_id=auth.uid())))
 );
create policy attendance_records_insert on public.attendance_records
 for insert to authenticated with check (
  exists(select 1 from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id
   where s.id=session_id and s.status in ('draft','returned')
    and (private.has_permission('teaching','create',o.org_unit_id) or (s.created_by=auth.uid() and private.has_permission('teaching','update',o.org_unit_id)))
    and exists(select 1 from public.student_enrollments e join public.class_groups cg on cg.id=e.class_group_id
      where e.id=enrollment_id and e.status='studying' and cg.id=o.class_group_id))
 );
create policy attendance_records_update on public.attendance_records
 for update to authenticated using (
  exists(select 1 from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id
   where s.id=session_id and s.status in ('draft','returned')
    and (private.has_permission('teaching','update',o.org_unit_id) or (s.created_by=auth.uid() and private.has_permission('teaching','create',o.org_unit_id))))
 ) with check (
  exists(select 1 from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id
   where s.id=session_id and s.status in ('draft','returned')
    and (private.has_permission('teaching','update',o.org_unit_id) or (s.created_by=auth.uid() and private.has_permission('teaching','create',o.org_unit_id)))
    and exists(select 1 from public.student_enrollments e join public.class_groups cg on cg.id=e.class_group_id
      where e.id=enrollment_id and e.status='studying' and cg.id=o.class_group_id))
 );

create policy gradebooks_select on public.gradebooks
 for select to authenticated using (
  exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('grades','view',o.org_unit_id))
 );
create policy gradebooks_insert on public.gradebooks
 for insert to authenticated with check (
  status='draft' and created_by=auth.uid()
  and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and o.status in ('planned','open') and private.has_permission('grades','create',o.org_unit_id))
 );
create policy gradebooks_update on public.gradebooks
 for update to authenticated using (
  status in ('draft','returned')
  and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('grades','update',o.org_unit_id))
 ) with check (
  status in ('draft','returned')
  and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('grades','update',o.org_unit_id))
 );

create policy grade_components_select on public.grade_components
 for select to authenticated using (
  exists(select 1 from public.gradebooks g join public.class_subject_offerings o on o.id=g.offering_id
   where g.id=gradebook_id and private.has_permission('grades','view',o.org_unit_id))
 );
create policy grade_components_insert on public.grade_components
 for insert to authenticated with check (
  exists(select 1 from public.gradebooks g join public.class_subject_offerings o on o.id=g.offering_id
   where g.id=gradebook_id and g.status in ('draft','returned') and private.has_permission('grades','create',o.org_unit_id))
 );
create policy grade_components_update on public.grade_components
 for update to authenticated using (
  exists(select 1 from public.gradebooks g join public.class_subject_offerings o on o.id=g.offering_id
   where g.id=gradebook_id and g.status in ('draft','returned') and private.has_permission('grades','update',o.org_unit_id))
 ) with check (
  exists(select 1 from public.gradebooks g join public.class_subject_offerings o on o.id=g.offering_id
   where g.id=gradebook_id and g.status in ('draft','returned') and private.has_permission('grades','update',o.org_unit_id))
 );

create policy grade_entries_select on public.grade_entries
 for select to authenticated using (
  exists(select 1 from public.grade_components c join public.gradebooks g on g.id=c.gradebook_id
   join public.class_subject_offerings o on o.id=g.offering_id
   where c.id=component_id and private.has_permission('grades','view',o.org_unit_id))
 );
create policy grade_entries_insert on public.grade_entries
 for insert to authenticated with check (
  exists(select 1 from public.grade_components c join public.gradebooks g on g.id=c.gradebook_id
   join public.class_subject_offerings o on o.id=g.offering_id
   join public.student_enrollments e on e.id=enrollment_id
   where c.id=component_id and g.status in ('draft','returned')
    and private.has_permission('grades','create',o.org_unit_id)
    and e.status='studying' and e.class_group_id=o.class_group_id)
 );
create policy grade_entries_update on public.grade_entries
 for update to authenticated using (
  exists(select 1 from public.grade_components c join public.gradebooks g on g.id=c.gradebook_id
   join public.class_subject_offerings o on o.id=g.offering_id
   where c.id=component_id and g.status in ('draft','returned') and private.has_permission('grades','update',o.org_unit_id))
 ) with check (
  exists(select 1 from public.grade_components c join public.gradebooks g on g.id=c.gradebook_id
   join public.class_subject_offerings o on o.id=g.offering_id
   join public.student_enrollments e on e.id=enrollment_id
   where c.id=component_id and g.status in ('draft','returned')
    and private.has_permission('grades','update',o.org_unit_id)
    and e.status='studying' and e.class_group_id=o.class_group_id)
 );

create or replace function private.validate_attendance_record()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_session public.attendance_sessions; v_offering public.class_subject_offerings;
begin
 select * into v_session from public.attendance_sessions where id=new.session_id;
 if not found or v_session.status not in ('draft','returned') then raise exception 'attendance session is not editable'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_session.offering_id;
 if not exists(select 1 from public.student_enrollments e where e.id=new.enrollment_id and e.status='studying' and e.class_group_id=v_offering.class_group_id) then
  raise exception 'student enrollment does not belong to this offering class';
 end if;
 if new.attendance_status<>'late' then new.minutes_late:=null; end if;
 return new;
end;
$$;
create trigger attendance_record_validate before insert or update on public.attendance_records
 for each row execute function private.validate_attendance_record();

create or replace function private.validate_grade_entry()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_gradebook public.gradebooks; v_offering public.class_subject_offerings; v_component public.grade_components;
begin
 select c.* into v_component from public.grade_components c where c.id=new.component_id;
 if not found then raise exception 'grade component not found'; end if;
 select g.* into v_gradebook from public.gradebooks g where g.id=v_component.gradebook_id;
 if not found or v_gradebook.status not in ('draft','returned') then raise exception 'gradebook is not editable'; end if;
 select o.* into v_offering from public.class_subject_offerings o where o.id=v_gradebook.offering_id;
 if new.score>v_component.max_score then raise exception 'score exceeds maximum score'; end if;
 if not exists(select 1 from public.student_enrollments e where e.id=new.enrollment_id and e.status='studying' and e.class_group_id=v_offering.class_group_id) then
  raise exception 'student enrollment does not belong to this gradebook class';
 end if;
 return new;
end;
$$;
create trigger grade_entry_validate before insert or update on public.grade_entries
 for each row execute function private.validate_grade_entry();

create or replace function public.get_offering_roster(p_offering_id uuid)
returns table(enrollment_id uuid,student_id uuid,student_code text,full_name text,enrollment_status text)
language plpgsql security definer set search_path=''
as $$
declare v_unit uuid; v_class uuid;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select o.org_unit_id,o.class_group_id into v_unit,v_class from public.class_subject_offerings o where o.id=p_offering_id;
 if not found then raise exception 'offering not found'; end if;
 if not private.has_permission('teaching','view',v_unit)
  and not private.has_permission('grades','view',v_unit)
  and not exists(select 1 from public.teaching_assignments a join public.staff s on s.id=a.staff_id
   where a.offering_id=p_offering_id and a.status='active' and s.user_id=auth.uid()
    and a.assigned_from<=current_date and (a.assigned_to is null or a.assigned_to>=current_date)) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 return query select e.id,s.id,s.student_code,s.full_name,e.status
  from public.student_enrollments e join public.students s on s.id=e.student_id
  where e.class_group_id=v_class and e.status='studying' and s.status='active'
  order by s.student_code;
end;
$$;

create or replace function public.submit_attendance_session(p_session_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_session public.attendance_sessions; v_offering public.class_subject_offerings; v_expected integer; v_actual integer;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into v_session from public.attendance_sessions where id=p_session_id for update;
 if not found then raise exception 'attendance session not found'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_session.offering_id;
 if not private.has_permission('teaching','update',v_offering.org_unit_id)
  and not (v_session.created_by=auth.uid() and private.has_permission('teaching','create',v_offering.org_unit_id)) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_session.status not in ('draft','returned') then raise exception 'attendance session cannot be submitted from current status'; end if;
 select count(*) into v_expected from public.student_enrollments e where e.class_group_id=v_offering.class_group_id and e.status='studying';
 select count(*) into v_actual from public.attendance_records r where r.session_id=p_session_id;
 if v_expected=0 or v_actual<>v_expected then raise exception 'attendance list incomplete: expected %, recorded %',v_expected,v_actual; end if;
 update public.attendance_sessions set status='submitted',submitted_by=auth.uid(),submitted_at=now(),updated_at=now() where id=p_session_id;
end;
$$;

create or replace function public.decide_attendance_session(p_session_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_session public.attendance_sessions; v_offering public.class_subject_offerings;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into v_session from public.attendance_sessions where id=p_session_id for update;
 if not found then raise exception 'attendance session not found'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_session.offering_id;
 if not private.has_permission('teaching','approve',v_offering.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_session.status<>'submitted' then raise exception 'attendance session is not awaiting approval'; end if;
 if v_session.created_by=auth.uid() then raise exception 'requester cannot approve own attendance session'; end if;
 update public.attendance_sessions set status=case when p_approve then 'approved' else 'returned' end,
  approved_by=case when p_approve then auth.uid() else null end,
  approved_at=case when p_approve then now() else null end,
  decision_note=left(coalesce(p_note,''),2000),updated_at=now()
 where id=p_session_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(auth.uid(),case when p_approve then 'approve_attendance' else 'return_attendance' end,'attendance_sessions',p_session_id::text,
  jsonb_build_object('note',left(coalesce(p_note,''),2000),'offering_id',v_offering.id));
end;
$$;

create or replace function public.submit_gradebook(p_gradebook_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_gradebook public.gradebooks; v_offering public.class_subject_offerings; v_weight numeric;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into v_gradebook from public.gradebooks where id=p_gradebook_id for update;
 if not found then raise exception 'gradebook not found'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_gradebook.offering_id;
 if not private.has_permission('grades','update',v_offering.org_unit_id)
  and not (v_gradebook.created_by=auth.uid() and private.has_permission('grades','create',v_offering.org_unit_id)) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_gradebook.status not in ('draft','returned') then raise exception 'gradebook cannot be submitted from current status'; end if;
 if not exists(select 1 from public.grade_components c where c.gradebook_id=p_gradebook_id) then raise exception 'gradebook has no assessment components'; end if;
 select coalesce(sum(c.weight),0) into v_weight from public.grade_components c where c.gradebook_id=p_gradebook_id;
 if v_weight<>100 then raise exception 'assessment weights must total exactly 100 percent'; end if;
 if exists(select 1 from public.grade_components c join public.student_enrollments e on e.class_group_id=v_offering.class_group_id and e.status='studying'
  left join public.grade_entries ge on ge.component_id=c.id and ge.enrollment_id=e.id
  where c.gradebook_id=p_gradebook_id and c.is_required and ge.id is null) then
  raise exception 'required assessment scores are incomplete'; end if;
 update public.gradebooks set status='submitted',submitted_by=auth.uid(),submitted_at=now(),updated_at=now() where id=p_gradebook_id;
end;
$$;

create or replace function public.decide_gradebook(p_gradebook_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_gradebook public.gradebooks; v_offering public.class_subject_offerings;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into v_gradebook from public.gradebooks where id=p_gradebook_id for update;
 if not found then raise exception 'gradebook not found'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_gradebook.offering_id;
 if not private.has_permission('grades','approve',v_offering.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_gradebook.status<>'submitted' then raise exception 'gradebook is not awaiting approval'; end if;
 if v_gradebook.created_by=auth.uid() then raise exception 'requester cannot approve own gradebook'; end if;
 update public.gradebooks set status=case when p_approve then 'approved' else 'returned' end,
  approved_by=case when p_approve then auth.uid() else null end,approved_at=case when p_approve then now() else null end,
  decision_note=left(coalesce(p_note,''),2000),updated_at=now() where id=p_gradebook_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(auth.uid(),case when p_approve then 'approve_gradebook' else 'return_gradebook' end,'gradebooks',p_gradebook_id::text,
  jsonb_build_object('note',left(coalesce(p_note,''),2000),'offering_id',v_offering.id));
end;
$$;

create or replace function public.lock_gradebook(p_gradebook_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_gradebook public.gradebooks; v_offering public.class_subject_offerings;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select * into v_gradebook from public.gradebooks where id=p_gradebook_id for update;
 if not found then raise exception 'gradebook not found'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_gradebook.offering_id;
 if not private.has_permission('grades','approve',v_offering.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_gradebook.status<>'approved' then raise exception 'only approved gradebooks can be locked'; end if;
 update public.gradebooks set status='locked',locked_by=auth.uid(),locked_at=now(),updated_at=now() where id=p_gradebook_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(auth.uid(),'lock_gradebook','gradebooks',p_gradebook_id::text,jsonb_build_object('offering_id',v_offering.id));
end;
$$;

create or replace function public.reopen_gradebook(p_gradebook_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_gradebook public.gradebooks; v_offering public.class_subject_offerings;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'reopen reason must contain at least 10 characters'; end if;
 select * into v_gradebook from public.gradebooks where id=p_gradebook_id for update;
 if not found then raise exception 'gradebook not found'; end if;
 select * into v_offering from public.class_subject_offerings where id=v_gradebook.offering_id;
 if not private.has_permission('grades','approve',v_offering.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_gradebook.status<>'locked' then raise exception 'only locked gradebooks can be reopened'; end if;
 update public.gradebooks set status='returned',decision_note=left(btrim(p_reason),2000),updated_at=now() where id=p_gradebook_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,old_data,new_data)
 values(auth.uid(),'reopen_gradebook','gradebooks',p_gradebook_id::text,
  jsonb_build_object('status','locked'),jsonb_build_object('status','returned','reason',left(btrim(p_reason),2000)));
end;
$$;

create or replace view public.gradebook_results with (security_invoker=true) as
select g.id as gradebook_id, e.enrollment_id,
 round(sum((e.score/c.max_score)*c.weight),2) as weighted_score,
 round(sum(c.weight),2) as completed_weight,
 count(e.id)::integer as completed_components,
 (select count(*)::integer from public.grade_components c2 where c2.gradebook_id=g.id) as component_count
from public.gradebooks g
join public.grade_components c on c.gradebook_id=g.id
join public.grade_entries e on e.component_id=c.id
group by g.id,e.enrollment_id;

revoke all on function public.get_offering_roster(uuid) from public,anon;
revoke all on function public.submit_attendance_session(uuid) from public,anon;
revoke all on function public.decide_attendance_session(uuid,boolean,text) from public,anon;
revoke all on function public.submit_gradebook(uuid) from public,anon;
revoke all on function public.decide_gradebook(uuid,boolean,text) from public,anon;
revoke all on function public.lock_gradebook(uuid) from public,anon;
revoke all on function public.reopen_gradebook(uuid,text) from public,anon;
grant execute on function public.get_offering_roster(uuid) to authenticated;
grant execute on function public.submit_attendance_session(uuid) to authenticated;
grant execute on function public.decide_attendance_session(uuid,boolean,text) to authenticated;
grant execute on function public.submit_gradebook(uuid) to authenticated;
grant execute on function public.decide_gradebook(uuid,boolean,text) to authenticated;
grant execute on function public.lock_gradebook(uuid) to authenticated;
grant execute on function public.reopen_gradebook(uuid,text) to authenticated;

grant select,insert,update on public.attendance_sessions,public.attendance_records,public.gradebooks,public.grade_components,public.grade_entries to authenticated;
grant select on public.gradebook_results to authenticated;

comment on table public.attendance_sessions is 'Buổi học theo lớp học phần; trạng thái draft/submitted/approved/returned/cancelled.';
comment on table public.gradebooks is 'Sổ điểm theo lớp học phần; chỉ được sửa khi draft/returned, khóa sau phê duyệt.';
comment on view public.gradebook_results is 'Điểm tổng hợp theo trọng số; security_invoker để giữ nguyên RLS của bảng nguồn.';

commit;
