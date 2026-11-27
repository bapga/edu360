begin;

create table public.class_subject_offerings (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 class_group_id uuid not null references public.class_groups(id),
 program_subject_id uuid not null references public.program_subjects(id),
 academic_term_id uuid not null references public.academic_terms(id),
 planned_hours integer not null check (planned_hours > 0),
 status text not null default 'planned' check (status in ('planned','open','completed','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(class_group_id,program_subject_id,academic_term_id)
);

create table public.classrooms (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 code text not null,
 name text not null,
 room_type text not null default 'classroom' check (room_type in ('classroom','workshop','laboratory','practice_area','other')),
 capacity integer check (capacity is null or capacity > 0),
 is_active boolean not null default true,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(org_unit_id,code)
);

create table public.teaching_assignments (
 id uuid primary key default gen_random_uuid(),
 offering_id uuid not null references public.class_subject_offerings(id),
 staff_id uuid not null references public.staff(id),
 org_unit_id uuid not null references public.org_units(id),
 assignment_role text not null default 'primary' check (assignment_role in ('primary','co_teacher','practice_supervisor')),
 assigned_from date not null,
 assigned_to date,
 status text not null default 'active' check (status in ('active','ended','cancelled')),
 assigned_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 check (assigned_to is null or assigned_to >= assigned_from),
 unique(offering_id,staff_id,assignment_role,assigned_from)
);

create table public.timetable_slots (
 id uuid primary key default gen_random_uuid(),
 offering_id uuid not null references public.class_subject_offerings(id),
 teaching_assignment_id uuid not null references public.teaching_assignments(id),
 classroom_id uuid references public.classrooms(id),
 day_of_week smallint not null check (day_of_week between 1 and 7),
 period_start smallint not null check (period_start > 0),
 period_end smallint not null check (period_end >= period_start),
 effective_from date not null,
 effective_to date not null,
 status text not null default 'draft' check (status in ('draft','published','cancelled')),
 note text,
 published_at timestamptz,
 published_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 check (effective_to >= effective_from)
);

create index class_subject_offerings_unit_term_idx on public.class_subject_offerings(org_unit_id,academic_term_id,status);
create index class_subject_offerings_class_idx on public.class_subject_offerings(class_group_id);
create index class_subject_offerings_program_subject_idx on public.class_subject_offerings(program_subject_id);
create index classrooms_unit_active_idx on public.classrooms(org_unit_id,is_active);
create index teaching_assignments_staff_dates_idx on public.teaching_assignments(staff_id,assigned_from,assigned_to,status);
create index teaching_assignments_offering_idx on public.teaching_assignments(offering_id,status);
create index timetable_slots_offering_day_idx on public.timetable_slots(offering_id,day_of_week,status);
create index timetable_slots_assignment_idx on public.timetable_slots(teaching_assignment_id);
create index timetable_slots_classroom_idx on public.timetable_slots(classroom_id);
create index timetable_slots_dates_idx on public.timetable_slots(effective_from,effective_to);

alter table public.class_subject_offerings enable row level security;
alter table public.classrooms enable row level security;
alter table public.teaching_assignments enable row level security;
alter table public.timetable_slots enable row level security;

create policy class_subject_offerings_select on public.class_subject_offerings
 for select to authenticated using (private.has_permission('training','view',org_unit_id));
create policy class_subject_offerings_insert on public.class_subject_offerings
 for insert to authenticated with check (
  private.has_permission('training','create',org_unit_id)
  and exists(select 1 from public.class_groups cg join public.cohorts c on c.id=cg.cohort_id
   where cg.id=class_group_id and cg.org_unit_id=class_subject_offerings.org_unit_id and c.org_unit_id=class_subject_offerings.org_unit_id)
  and exists(select 1 from public.academic_terms t join public.academic_years y on y.id=t.academic_year_id
   where t.id=academic_term_id and y.org_unit_id=class_subject_offerings.org_unit_id)
  and exists(select 1 from public.program_subjects ps join public.program_versions pv on pv.id=ps.program_version_id
   join public.training_programs p on p.id=pv.program_id
   where ps.id=program_subject_id and p.org_unit_id=class_subject_offerings.org_unit_id and pv.status='approved')
 );
create policy class_subject_offerings_update on public.class_subject_offerings
 for update to authenticated using (private.has_permission('training','update',org_unit_id))
 with check (private.has_permission('training','update',org_unit_id));

create policy classrooms_select on public.classrooms for select to authenticated
 using(private.has_permission('teaching','view',org_unit_id));
create policy classrooms_insert on public.classrooms for insert to authenticated
 with check(private.has_permission('teaching','create',org_unit_id));
create policy classrooms_update on public.classrooms for update to authenticated
 using(private.has_permission('teaching','update',org_unit_id))
 with check(private.has_permission('teaching','update',org_unit_id));

create policy teaching_assignments_select on public.teaching_assignments for select to authenticated
 using(private.has_permission('teaching','view',org_unit_id));
create policy teaching_assignments_insert on public.teaching_assignments for insert to authenticated
 with check(private.has_permission('teaching','create',org_unit_id));
create policy teaching_assignments_update on public.teaching_assignments for update to authenticated
 using(private.has_permission('teaching','update',org_unit_id))
 with check(private.has_permission('teaching','update',org_unit_id));

create policy timetable_slots_select on public.timetable_slots for select to authenticated
 using(exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','view',o.org_unit_id)));
create policy timetable_slots_insert on public.timetable_slots for insert to authenticated
 with check(status='draft' and exists(
  select 1 from public.class_subject_offerings o
  join public.teaching_assignments a on a.offering_id=o.id
  where o.id=offering_id and a.id=teaching_assignment_id
   and o.status in ('planned','open') and a.status='active'
   and a.assigned_from <= effective_from and (a.assigned_to is null or a.assigned_to >= effective_to)
   and private.has_permission('teaching','create',o.org_unit_id)
 ));
create policy timetable_slots_update on public.timetable_slots for update to authenticated
 using(status='draft' and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','update',o.org_unit_id)))
 with check(status='draft' and exists(select 1 from public.class_subject_offerings o where o.id=offering_id and private.has_permission('teaching','update',o.org_unit_id)));

create or replace function private.validate_teaching_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_offering public.class_subject_offerings;
 v_staff public.staff;
begin
 select * into v_offering from public.class_subject_offerings where id=new.offering_id;
 if not found or v_offering.org_unit_id <> new.org_unit_id then
  raise exception 'offering and assignment unit do not match';
 end if;
 select * into v_staff from public.staff where id=new.staff_id and deleted_at is null and status='active';
 if not found then raise exception 'staff record is not active'; end if;
 if not exists (
  select 1 from public.staff_assignments sa
  where sa.staff_id=new.staff_id and sa.org_unit_id=new.org_unit_id and sa.status='active'
   and sa.start_date <= new.assigned_from
   and (sa.end_date is null or sa.end_date >= coalesce(new.assigned_to,new.assigned_from))
 ) then raise exception 'staff has no active assignment for the requested period'; end if;
 if new.status='active' and exists (
  select 1 from public.teaching_assignments a
  where a.staff_id=new.staff_id and a.status='active' and a.id <> coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid)
   and a.assigned_from <= coalesce(new.assigned_to,'infinity'::date)
   and coalesce(a.assigned_to,'infinity'::date) >= new.assigned_from
   and a.offering_id=new.offering_id and a.assignment_role=new.assignment_role
 ) then raise exception 'duplicate active teaching assignment period'; end if;
 return new;
end;
$$;

create trigger teaching_assignment_validate
 before insert or update on public.teaching_assignments
 for each row execute function private.validate_teaching_assignment();

create or replace function private.validate_timetable_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_offering public.class_subject_offerings;
 v_assignment public.teaching_assignments;
 v_room public.classrooms;
begin
 select * into v_offering from public.class_subject_offerings where id=new.offering_id;
 select * into v_assignment from public.teaching_assignments where id=new.teaching_assignment_id;
 if not found or v_assignment.offering_id <> new.offering_id or v_assignment.status <> 'active' then
  raise exception 'teaching assignment is invalid for this offering';
 end if;
 if v_assignment.assigned_from > new.effective_from or (v_assignment.assigned_to is not null and v_assignment.assigned_to < new.effective_to) then
  raise exception 'teaching assignment does not cover the timetable dates';
 end if;
 if new.classroom_id is not null then
  select * into v_room from public.classrooms where id=new.classroom_id and is_active;
  if not found or v_room.org_unit_id <> v_offering.org_unit_id then
   raise exception 'classroom is inactive or belongs to another unit';
  end if;
 end if;
 if new.status <> 'draft' and tg_op='INSERT' then
  raise exception 'new timetable slots must start as draft';
 end if;
 return new;
end;
$$;

create trigger timetable_slot_validate
 before insert or update on public.timetable_slots
 for each row execute function private.validate_timetable_slot();

create or replace function public.publish_timetable(p_academic_term_id uuid,p_org_unit_id uuid,p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_uid uuid := (select auth.uid());
 v_count integer;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if not private.has_permission('teaching','approve',p_org_unit_id) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,''))) < 10 then
  raise exception 'publication reason must contain at least 10 characters';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_academic_term_id::text,0));
 if not exists(select 1 from public.academic_terms t join public.academic_years y on y.id=t.academic_year_id
  where t.id=p_academic_term_id and y.org_unit_id=p_org_unit_id) then
  raise exception 'academic term does not belong to this unit';
 end if;
 if not exists(select 1 from public.timetable_slots s join public.class_subject_offerings o on o.id=s.offering_id
  where o.academic_term_id=p_academic_term_id and o.org_unit_id=p_org_unit_id and s.status='draft') then
  raise exception 'no draft timetable slots to publish';
 end if;
 if exists (
  select 1
  from public.timetable_slots a
  join public.class_subject_offerings oa on oa.id=a.offering_id
  join public.teaching_assignments aa on aa.id=a.teaching_assignment_id
  join public.class_groups cga on cga.id=oa.class_group_id
  join public.timetable_slots b on b.id>a.id
  join public.class_subject_offerings ob on ob.id=b.offering_id
  join public.teaching_assignments ab on ab.id=b.teaching_assignment_id
  join public.class_groups cgb on cgb.id=ob.class_group_id
  where oa.academic_term_id=p_academic_term_id and oa.org_unit_id=p_org_unit_id
   and ob.academic_term_id=p_academic_term_id and ob.org_unit_id=p_org_unit_id
   and a.status in ('draft','published') and b.status in ('draft','published')
   and a.day_of_week=b.day_of_week
   and a.effective_from <= b.effective_to and b.effective_from <= a.effective_to
   and a.period_start <= b.period_end and b.period_start <= a.period_end
   and (cga.id=cgb.id or aa.staff_id=ab.staff_id or (a.classroom_id is not null and a.classroom_id=b.classroom_id))
 ) then
  raise exception 'timetable conflict: class, teacher or classroom overlaps';
 end if;
 update public.timetable_slots s
 set status='published',published_at=now(),published_by=v_uid,updated_at=now(),updated_by=v_uid
 from public.class_subject_offerings o
 where o.id=s.offering_id and o.academic_term_id=p_academic_term_id and o.org_unit_id=p_org_unit_id and s.status='draft';
 get diagnostics v_count = row_count;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,'publish_timetable','timetable_slots',p_academic_term_id::text,
  pg_catalog.jsonb_build_object('org_unit_id',p_org_unit_id,'published_slots',v_count,'reason',pg_catalog.btrim(p_reason)));
 return v_count;
end;
$$;

revoke all on function public.publish_timetable(uuid,uuid,text) from public,anon;
grant execute on function public.publish_timetable(uuid,uuid,text) to authenticated;
grant select,insert,update on public.class_subject_offerings,public.classrooms,public.teaching_assignments,public.timetable_slots to authenticated;

comment on table public.class_subject_offerings is 'Lớp học phần theo lớp hành chính và học kỳ; liên kết chương trình đã phê duyệt.';
comment on table public.teaching_assignments is 'Phân công giảng dạy; giáo viên phải có phân công công tác hiệu lực trong cùng đơn vị.';
comment on table public.timetable_slots is 'Tiết học dự thảo/công bố; công bố nguyên tử qua publish_timetable và kiểm tra xung đột lớp, giáo viên, phòng.';

commit;
