-- EDU360 attendance and grade foundation (additive, no data seeding)
create table public.attendance_sessions (
 id uuid primary key default gen_random_uuid(),
 offering_id uuid not null references public.class_subject_offerings(id) on delete restrict,
 timetable_slot_id uuid references public.timetable_slots(id) on delete set null,
 session_date date not null, session_no integer not null default 1 check(session_no>0),
 planned_periods numeric(5,2) not null default 1 check(planned_periods>0),
 status text not null default 'draft' check(status in ('draft','open','submitted','approved','cancelled')),
 note text, created_by uuid not null default auth.uid() references auth.users(id),
 submitted_by uuid references auth.users(id), approved_by uuid references auth.users(id),
 submitted_at timestamptz, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(offering_id,session_date,session_no), check(approved_by is null or approved_by<>submitted_by)
);
create table public.attendance_records (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.attendance_sessions(id) on delete cascade,
 student_enrollment_id uuid not null references public.student_enrollments(id) on delete restrict,
 attendance_status text not null check(attendance_status in ('present','late','absent_excused','absent_unexcused')),
 periods_absent numeric(5,2) not null default 0 check(periods_absent>=0),
 note text, marked_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(session_id,student_enrollment_id)
);
create table public.grade_sheets (
 id uuid primary key default gen_random_uuid(),
 offering_id uuid not null references public.class_subject_offerings(id) on delete restrict,
 sheet_code text not null, status text not null default 'draft' check(status in ('draft','submitted','approved','locked','reopened')),
 grading_scale numeric(6,2) not null default 10 check(grading_scale>0), formula_note text,
 submitted_by uuid references auth.users(id), submitted_at timestamptz,
 approved_by uuid references auth.users(id), approved_at timestamptz,
 locked_by uuid references auth.users(id), locked_at timestamptz,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(offering_id,sheet_code), check(approved_by is null or submitted_by is null or approved_by<>submitted_by)
);
create table public.grade_components (
 id uuid primary key default gen_random_uuid(),
 grade_sheet_id uuid not null references public.grade_sheets(id) on delete cascade,
 component_code text not null, component_name text not null,
 weight numeric(7,4) not null check(weight>0 and weight<=1),
 max_score numeric(6,2) not null default 10 check(max_score>0),
 sequence_no integer not null default 1 check(sequence_no>0),
 created_at timestamptz not null default now(), unique(grade_sheet_id,component_code)
);
create table public.grade_entries (
 id uuid primary key default gen_random_uuid(),
 grade_sheet_id uuid not null references public.grade_sheets(id) on delete cascade,
 grade_component_id uuid not null references public.grade_components(id) on delete cascade,
 student_enrollment_id uuid not null references public.student_enrollments(id) on delete restrict,
 score numeric(7,3) check(score>=0), comment text,
 entered_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(grade_component_id,student_enrollment_id)
);
create index attendance_sessions_offering_date_idx on public.attendance_sessions(offering_id,session_date);
create index attendance_records_enrollment_idx on public.attendance_records(student_enrollment_id);
create index grade_sheets_offering_idx on public.grade_sheets(offering_id,status);
create index grade_components_sheet_idx on public.grade_components(grade_sheet_id,sequence_no);
create index grade_entries_sheet_enrollment_idx on public.grade_entries(grade_sheet_id,student_enrollment_id);

create function private.validate_attendance_record() returns trigger language plpgsql set search_path='' as $$
declare v_class uuid; v_enrollment_class uuid; v_unit uuid;
begin
 select o.class_group_id,o.org_unit_id into v_class,v_unit from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id where s.id=new.session_id;
 select e.class_group_id into v_enrollment_class from public.student_enrollments e where e.id=new.student_enrollment_id and e.status='active';
 if v_class is null or v_enrollment_class is distinct from v_class then raise exception 'student enrollment does not belong to attendance class'; end if;
 if new.periods_absent > (select planned_periods from public.attendance_sessions where id=new.session_id) then raise exception 'absent periods exceed planned periods'; end if;
 return new;
end $$;
create trigger attendance_record_integrity before insert or update on public.attendance_records for each row execute function private.validate_attendance_record();

create function private.validate_grade_entry() returns trigger language plpgsql set search_path='' as $$
declare v_sheet uuid; v_class uuid; v_enrollment_class uuid; v_max numeric;
begin
 select c.grade_sheet_id,c.max_score into v_sheet,v_max from public.grade_components c where c.id=new.grade_component_id;
 if v_sheet is distinct from new.grade_sheet_id then raise exception 'grade component does not belong to grade sheet'; end if;
 if new.score is not null and new.score>v_max then raise exception 'score exceeds component maximum'; end if;
 select o.class_group_id into v_class from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=new.grade_sheet_id;
 select e.class_group_id into v_enrollment_class from public.student_enrollments e where e.id=new.student_enrollment_id and e.status='active';
 if v_class is null or v_enrollment_class is distinct from v_class then raise exception 'student enrollment does not belong to grade sheet class'; end if;
 return new;
end $$;
create trigger grade_entry_integrity before insert or update on public.grade_entries for each row execute function private.validate_grade_entry();

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.grade_sheets enable row level security;
alter table public.grade_components enable row level security;
alter table public.grade_entries enable row level security;

create policy attendance_sessions_read on public.attendance_sessions for select to authenticated using(exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','view',o.org_unit_id)));
create policy attendance_sessions_insert on public.attendance_sessions for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','create',o.org_unit_id)));
create policy attendance_sessions_update on public.attendance_sessions for update to authenticated using(status in ('draft','open') and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','update',o.org_unit_id))) with check(status in ('draft','open') and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','update',o.org_unit_id)));
create policy attendance_records_read on public.attendance_records for select to authenticated using(exists(select 1 from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id where s.id=session_id and private.has_permission('teaching','view',o.org_unit_id)));
create policy attendance_records_insert on public.attendance_records for insert to authenticated with check(marked_by=auth.uid() and exists(select 1 from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id where s.id=session_id and s.status in ('draft','open') and private.has_permission('teaching','create',o.org_unit_id)));
create policy attendance_records_update on public.attendance_records for update to authenticated using(exists(select 1 from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id where s.id=session_id and s.status in ('draft','open') and private.has_permission('teaching','update',o.org_unit_id))) with check(exists(select 1 from public.attendance_sessions s join public.class_subject_offerings o on o.id=s.offering_id where s.id=session_id and s.status in ('draft','open') and private.has_permission('teaching','update',o.org_unit_id)));

create policy grade_sheets_read on public.grade_sheets for select to authenticated using(exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('grades','view',o.org_unit_id)));
create policy grade_sheets_insert on public.grade_sheets for insert to authenticated with check(created_by=auth.uid() and status='draft' and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('grades','create',o.org_unit_id)));
create policy grade_sheets_update on public.grade_sheets for update to authenticated using(status in ('draft','reopened') and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('grades','update',o.org_unit_id))) with check(status in ('draft','reopened') and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('grades','update',o.org_unit_id)));
create policy grade_components_read on public.grade_components for select to authenticated using(exists(select 1 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=grade_sheet_id and private.has_permission('grades','view',o.org_unit_id)));
create policy grade_components_insert on public.grade_components for insert to authenticated with check(exists(select 1 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=grade_sheet_id and g.status in ('draft','reopened') and private.has_permission('grades','create',o.org_unit_id)));
create policy grade_components_update on public.grade_components for update to authenticated using(exists(select 1 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=grade_sheet_id and g.status in ('draft','reopened') and private.has_permission('grades','update',o.org_unit_id))) with check(exists(select 1 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=grade_sheet_id and g.status in ('draft','reopened') and private.has_permission('grades','update',o.org_unit_id)));
create policy grade_entries_read on public.grade_entries for select to authenticated using(exists(select 1 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=grade_sheet_id and private.has_permission('grades','view',o.org_unit_id)));
create policy grade_entries_insert on public.grade_entries for insert to authenticated with check(entered_by=auth.uid() and exists(select 1 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=grade_sheet_id and g.status in ('draft','reopened') and private.has_permission('grades','create',o.org_unit_id)));
create policy grade_entries_update on public.grade_entries for update to authenticated using(exists(select 1 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=grade_sheet_id and g.status in ('draft','reopened') and private.has_permission('grades','update',o.org_unit_id))) with check(updated_by=auth.uid() and exists(select 1 from public.grade_sheets g join public.class_subject_offerings o on o.id=g.offering_id where g.id=grade_sheet_id and g.status in ('draft','reopened') and private.has_permission('grades','update',o.org_unit_id)));

create function public.submit_grade_sheet(p_grade_sheet_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_sheet public.grade_sheets; v_unit uuid; v_weight numeric;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_sheet from public.grade_sheets where id=p_grade_sheet_id for update;
 if not found then raise exception 'grade sheet not found'; end if;
 select org_unit_id into v_unit from public.class_subject_offerings where id=v_sheet.offering_id;
 if not private.has_permission('grades','update',v_unit) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_sheet.status not in ('draft','reopened') then raise exception 'grade sheet is not editable'; end if;
 select coalesce(sum(weight),0) into v_weight from public.grade_components where grade_sheet_id=p_grade_sheet_id;
 if abs(v_weight-1)>0.0001 then raise exception 'component weights must total 100 percent'; end if;
 if not exists(select 1 from public.grade_entries where grade_sheet_id=p_grade_sheet_id) then raise exception 'no grades entered'; end if;
 if exists(select 1 from public.grade_entries e join public.grade_components c on c.id=e.grade_component_id where e.grade_sheet_id=p_grade_sheet_id and (e.score is null or e.score>c.max_score)) then raise exception 'missing or out-of-range scores'; end if;
 update public.grade_sheets set status='submitted',submitted_by=v_uid,submitted_at=now(),updated_at=now() where id=p_grade_sheet_id;
end $$;
create function public.approve_grade_sheet(p_grade_sheet_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_sheet public.grade_sheets; v_unit uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'approval reason must contain at least 10 characters'; end if;
 select * into v_sheet from public.grade_sheets where id=p_grade_sheet_id for update;
 if not found then raise exception 'grade sheet not found'; end if;
 select org_unit_id into v_unit from public.class_subject_offerings where id=v_sheet.offering_id;
 if not private.has_permission('grades','approve',v_unit) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_sheet.status<>'submitted' then raise exception 'only submitted grade sheets can be approved'; end if;
 if v_sheet.submitted_by=v_uid then raise exception 'submitter cannot approve own grade sheet' using errcode='42501'; end if;
 update public.grade_sheets set status='approved',approved_by=v_uid,approved_at=now(),updated_at=now() where id=p_grade_sheet_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data) values(v_uid,'approve_grade_sheet','grade_sheets',p_grade_sheet_id::text,jsonb_build_object('reason',btrim(p_reason)));
end $$;
create function public.lock_grade_sheet(p_grade_sheet_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_sheet public.grade_sheets; v_unit uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_reason,'')))<10 then raise exception 'lock reason must contain at least 10 characters'; end if;
 select * into v_sheet from public.grade_sheets where id=p_grade_sheet_id for update;
 if not found then raise exception 'grade sheet not found'; end if;
 select org_unit_id into v_unit from public.class_subject_offerings where id=v_sheet.offering_id;
 if not private.has_permission('grades','approve',v_unit) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_sheet.status<>'approved' then raise exception 'only approved grade sheets can be locked'; end if;
 update public.grade_sheets set status='locked',locked_by=v_uid,locked_at=now(),updated_at=now() where id=p_grade_sheet_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data) values(v_uid,'lock_grade_sheet','grade_sheets',p_grade_sheet_id::text,jsonb_build_object('reason',btrim(p_reason)));
end $$;
revoke all on function public.submit_grade_sheet(uuid) from public,anon;
revoke all on function public.approve_grade_sheet(uuid,text) from public,anon;
revoke all on function public.lock_grade_sheet(uuid,text) from public,anon;
grant execute on function public.submit_grade_sheet(uuid) to authenticated;
grant execute on function public.approve_grade_sheet(uuid,text) to authenticated;
grant execute on function public.lock_grade_sheet(uuid,text) to authenticated;
