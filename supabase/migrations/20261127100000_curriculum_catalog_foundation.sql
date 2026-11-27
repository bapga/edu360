begin;

create table if not exists public.occupations (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 code text not null,
 name text not null,
 qualification_level text not null check (qualification_level in ('so_cap','trung_cap','cao_dang','other')),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(org_unit_id,code)
);

create table if not exists public.training_programs (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 occupation_id uuid not null references public.occupations(id),
 code text not null,
 name text not null,
 qualification_level text not null check (qualification_level in ('so_cap','trung_cap','cao_dang','other')),
 total_hours integer not null check (total_hours > 0),
 duration_months integer check (duration_months is null or duration_months > 0),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(org_unit_id,code)
);

create table if not exists public.program_versions (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.training_programs(id),
 version_code text not null,
 effective_from date not null,
 effective_to date,
 decision_number text,
 decision_date date,
 status text not null default 'draft' check (status in ('draft','review','approved','retired')),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(program_id,version_code),
 check(effective_to is null or effective_to >= effective_from),
 check(status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table if not exists public.subjects (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 code text not null,
 name text not null,
 subject_type text not null check (subject_type in ('general','vocational','practice','internship','other')),
 default_hours integer check (default_hours is null or default_hours >= 0),
 grading_scale numeric(6,2) not null default 10 check (grading_scale > 0),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(org_unit_id,code)
);

create table if not exists public.program_subjects (
 id uuid primary key default gen_random_uuid(),
 program_version_id uuid not null references public.program_versions(id),
 subject_id uuid not null references public.subjects(id),
 term_no integer not null check (term_no > 0),
 sequence_no integer not null check (sequence_no > 0),
 theory_hours integer not null default 0 check (theory_hours >= 0),
 practice_hours integer not null default 0 check (practice_hours >= 0),
 internship_hours integer not null default 0 check (internship_hours >= 0),
 total_hours integer generated always as (theory_hours + practice_hours + internship_hours) stored,
 required boolean not null default true,
 prerequisites text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(program_version_id,subject_id,term_no),
 unique(program_version_id,sequence_no),
 check (theory_hours + practice_hours + internship_hours > 0)
);

create table if not exists public.academic_years (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 code text not null,
 starts_on date not null,
 ends_on date not null,
 status text not null default 'planned' check (status in ('planned','active','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(org_unit_id,code),
 check(ends_on > starts_on)
);

create table if not exists public.academic_terms (
 id uuid primary key default gen_random_uuid(),
 academic_year_id uuid not null references public.academic_years(id),
 term_code text not null,
 name text not null,
 starts_on date not null,
 ends_on date not null,
 status text not null default 'planned' check (status in ('planned','active','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(academic_year_id,term_code),
 check(ends_on >= starts_on)
);

create index if not exists training_programs_occupation_idx on public.training_programs(occupation_id);
create index if not exists program_versions_program_status_idx on public.program_versions(program_id,status);
create index if not exists program_subjects_subject_idx on public.program_subjects(subject_id);
create index if not exists academic_terms_year_dates_idx on public.academic_terms(academic_year_id,starts_on,ends_on);

alter table public.occupations enable row level security;
alter table public.training_programs enable row level security;
alter table public.program_versions enable row level security;
alter table public.subjects enable row level security;
alter table public.program_subjects enable row level security;
alter table public.academic_years enable row level security;
alter table public.academic_terms enable row level security;

create policy occupations_select on public.occupations for select to authenticated
using(private.has_permission('training','view',org_unit_id));
create policy occupations_insert on public.occupations for insert to authenticated
with check(private.has_permission('training','create',org_unit_id));
create policy occupations_update on public.occupations for update to authenticated
using(private.has_permission('training','update',org_unit_id))
with check(private.has_permission('training','update',org_unit_id));

create policy training_programs_select on public.training_programs for select to authenticated
using(private.has_permission('training','view',org_unit_id));
create policy training_programs_insert on public.training_programs for insert to authenticated
with check(private.has_permission('training','create',org_unit_id) and exists(select 1 from public.occupations o where o.id=occupation_id and o.org_unit_id=training_programs.org_unit_id));
create policy training_programs_update on public.training_programs for update to authenticated
using(private.has_permission('training','update',org_unit_id))
with check(private.has_permission('training','update',org_unit_id) and exists(select 1 from public.occupations o where o.id=occupation_id and o.org_unit_id=training_programs.org_unit_id));

create policy program_versions_select on public.program_versions for select to authenticated
using(exists(select 1 from public.training_programs p where p.id=program_id and private.has_permission('training','view',p.org_unit_id)));
create policy program_versions_insert on public.program_versions for insert to authenticated
with check(exists(select 1 from public.training_programs p where p.id=program_id and private.has_permission('training','create',p.org_unit_id)));
create policy program_versions_update on public.program_versions for update to authenticated
using(status in ('draft','review') and exists(select 1 from public.training_programs p where p.id=program_id and private.has_permission('training','update',p.org_unit_id)))
with check(status in ('draft','review') and exists(select 1 from public.training_programs p where p.id=program_id and private.has_permission('training','update',p.org_unit_id)));

create policy subjects_select on public.subjects for select to authenticated
using(private.has_permission('training','view',org_unit_id));
create policy subjects_insert on public.subjects for insert to authenticated
with check(private.has_permission('training','create',org_unit_id));
create policy subjects_update on public.subjects for update to authenticated
using(private.has_permission('training','update',org_unit_id))
with check(private.has_permission('training','update',org_unit_id));

create policy program_subjects_select on public.program_subjects for select to authenticated
using(exists(select 1 from public.program_versions v join public.training_programs p on p.id=v.program_id where v.id=program_version_id and private.has_permission('training','view',p.org_unit_id)));
create policy program_subjects_insert on public.program_subjects for insert to authenticated
with check(exists(select 1 from public.program_versions v join public.training_programs p on p.id=v.program_id join public.subjects s on s.id=subject_id where v.id=program_version_id and v.status='draft' and s.org_unit_id=p.org_unit_id and private.has_permission('training','create',p.org_unit_id)));
create policy program_subjects_update on public.program_subjects for update to authenticated
using(exists(select 1 from public.program_versions v join public.training_programs p on p.id=v.program_id where v.id=program_version_id and v.status='draft' and private.has_permission('training','update',p.org_unit_id)))
with check(exists(select 1 from public.program_versions v join public.training_programs p on p.id=v.program_id join public.subjects s on s.id=subject_id where v.id=program_version_id and v.status='draft' and s.org_unit_id=p.org_unit_id and private.has_permission('training','update',p.org_unit_id)));

create policy academic_years_select on public.academic_years for select to authenticated
using(private.has_permission('training','view',org_unit_id));
create policy academic_years_insert on public.academic_years for insert to authenticated
with check(private.has_permission('training','create',org_unit_id));
create policy academic_years_update on public.academic_years for update to authenticated
using(private.has_permission('training','update',org_unit_id))
with check(private.has_permission('training','update',org_unit_id));

create policy academic_terms_select on public.academic_terms for select to authenticated
using(exists(select 1 from public.academic_years y where y.id=academic_year_id and private.has_permission('training','view',y.org_unit_id)));
create policy academic_terms_insert on public.academic_terms for insert to authenticated
with check(exists(select 1 from public.academic_years y where y.id=academic_year_id and y.starts_on <= academic_terms.starts_on and y.ends_on >= academic_terms.ends_on and private.has_permission('training','create',y.org_unit_id)));
create policy academic_terms_update on public.academic_terms for update to authenticated
using(exists(select 1 from public.academic_years y where y.id=academic_year_id and private.has_permission('training','update',y.org_unit_id)))
with check(exists(select 1 from public.academic_years y where y.id=academic_year_id and y.starts_on <= academic_terms.starts_on and y.ends_on >= academic_terms.ends_on and private.has_permission('training','update',y.org_unit_id)));

create or replace function public.approve_program_version(p_version_id uuid,p_decision_number text,p_reason text)
returns text language plpgsql security definer set search_path = ''
as $$
declare
 v_uid uuid := (select auth.uid());
 v_version public.program_versions;
 v_unit uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select v.* into v_version from public.program_versions v where v.id=p_version_id for update;
 if not found then raise exception 'program version not found'; end if;
 select p.org_unit_id into v_unit from public.training_programs p where p.id=v_version.program_id;
 if not private.has_permission('training','approve',v_unit) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_version.status not in ('draft','review') then raise exception 'version is not awaiting approval'; end if;
 if not exists(select 1 from public.program_subjects ps where ps.program_version_id=p_version_id) then raise exception 'program version must contain at least one subject'; end if;
 if length(pg_catalog.btrim(coalesce(p_decision_number,'')))=0 then raise exception 'decision number is required'; end if;
 if length(pg_catalog.btrim(coalesce(p_reason,'')))<10 then raise exception 'approval reason is required'; end if;
 update public.program_versions set status='approved',decision_number=pg_catalog.btrim(p_decision_number),approved_by=v_uid,approved_at=now(),updated_at=now(),updated_by=v_uid where id=p_version_id;
 return 'approved';
end $$;

revoke all on function public.approve_program_version(uuid,text,text) from public,anon;
grant execute on function public.approve_program_version(uuid,text,text) to authenticated;

grant select,insert,update on public.occupations,public.training_programs,public.program_versions,public.subjects,public.program_subjects,public.academic_years,public.academic_terms to authenticated;

comment on table public.program_versions is 'Phiên bản chương trình đào tạo; sau phê duyệt không được sửa hồi tố.';
comment on table public.program_subjects is 'Danh sách học phần và thời lượng thuộc phiên bản chương trình.';
comment on table public.subjects is 'Danh mục học phần; không dùng tên modules để tránh xung đột với bảng phân quyền phần mềm.';

commit;
