begin;

create table if not exists public.admission_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null references public.org_units(id),
  campaign_code text not null,
  name text not null,
  academic_year text not null,
  quota integer check (quota is null or quota >= 0),
  starts_on date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft','open','closed','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (org_unit_id, campaign_code),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admission_campaigns(id),
  org_unit_id uuid not null references public.org_units(id),
  application_code text not null,
  full_name text not null,
  date_of_birth date,
  gender text check (gender is null or gender in ('male','female','other')),
  national_id text,
  phone text,
  email text,
  address text,
  desired_occupation text,
  guardian_name text,
  guardian_phone text,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','needs_update','eligible','admitted','waitlisted','rejected','enrolled','withdrawn')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (campaign_id, application_code)
);

create table if not exists public.applicant_documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id),
  document_type text not null,
  object_path text not null,
  original_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (applicant_id, object_path)
);

create table if not exists public.admission_decisions (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id),
  decision text not null check (decision in ('eligible','admitted','waitlisted','rejected','needs_update')),
  decision_date date not null default current_date,
  reason text,
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  unique (applicant_id, id)
);

create table if not exists public.admission_status_events (
  id bigint generated always as identity primary key,
  applicant_id uuid not null references public.applicants(id),
  from_status text,
  to_status text not null,
  reason text,
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now()
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null references public.org_units(id),
  cohort_code text not null,
  name text not null,
  start_year integer not null check (start_year between 2000 and 2200),
  end_year integer not null check (end_year between 2000 and 2200),
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (org_unit_id, cohort_code),
  check (end_year >= start_year)
);

create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null references public.org_units(id),
  cohort_id uuid not null references public.cohorts(id),
  class_code text not null,
  name text not null,
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (cohort_id, class_code)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  org_unit_id uuid not null references public.org_units(id),
  student_code text not null unique,
  full_name text not null,
  date_of_birth date,
  gender text check (gender is null or gender in ('male','female','other')),
  national_id text,
  phone text,
  email text,
  address text,
  status text not null default 'active' check (status in ('active','reserved','withdrawn','graduated','transferred')),
  source_applicant_id uuid unique references public.applicants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  cohort_id uuid not null references public.cohorts(id),
  class_group_id uuid references public.class_groups(id),
  enrollment_code text not null unique,
  enrollment_date date not null,
  status text not null default 'studying' check (status in ('studying','reserved','withdrawn','graduated','transferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.applicant_enrollments (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null unique references public.applicants(id),
  student_enrollment_id uuid not null unique references public.student_enrollments(id),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null references auth.users(id)
);

create table if not exists public.student_class_history (
  id uuid primary key default gen_random_uuid(),
  student_enrollment_id uuid not null references public.student_enrollments(id),
  class_group_id uuid references public.class_groups(id),
  event_type text not null check (event_type in ('assigned','transferred','reserved','resumed','withdrawn','graduated')),
  effective_from date not null,
  effective_to date,
  reason text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  full_name text not null,
  relationship text not null,
  phone text,
  email text,
  address text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  student_enrollment_id uuid references public.student_enrollments(id),
  document_type text not null,
  object_path text not null,
  original_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (student_id, object_path)
);

create index if not exists applicants_campaign_status_idx on public.applicants(campaign_id, status);
create index if not exists applicants_org_name_idx on public.applicants(org_unit_id, full_name);
create index if not exists applicant_documents_applicant_idx on public.applicant_documents(applicant_id);
create index if not exists admission_decisions_applicant_date_idx on public.admission_decisions(applicant_id, decided_at desc);
create index if not exists admission_events_applicant_date_idx on public.admission_status_events(applicant_id, occurred_at desc);
create index if not exists class_groups_org_cohort_idx on public.class_groups(org_unit_id, cohort_id);
create index if not exists students_org_status_idx on public.students(org_unit_id, status);
create index if not exists student_enrollments_student_idx on public.student_enrollments(student_id);
create index if not exists student_enrollments_cohort_class_idx on public.student_enrollments(cohort_id, class_group_id, status);
create index if not exists student_class_history_enrollment_idx on public.student_class_history(student_enrollment_id, effective_from desc);
create index if not exists student_guardians_student_idx on public.student_guardians(student_id);
create index if not exists student_documents_student_idx on public.student_documents(student_id);

alter table public.admission_campaigns enable row level security;
alter table public.applicants enable row level security;
alter table public.applicant_documents enable row level security;
alter table public.admission_decisions enable row level security;
alter table public.admission_status_events enable row level security;
alter table public.cohorts enable row level security;
alter table public.class_groups enable row level security;
alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.applicant_enrollments enable row level security;
alter table public.student_class_history enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_documents enable row level security;

create policy admissions_campaign_select on public.admission_campaigns for select to authenticated
using (private.has_permission('admissions','view',org_unit_id));
create policy admissions_campaign_insert on public.admission_campaigns for insert to authenticated
with check (private.has_permission('admissions','create',org_unit_id));
create policy admissions_campaign_update on public.admission_campaigns for update to authenticated
using (private.has_permission('admissions','update',org_unit_id))
with check (private.has_permission('admissions','update',org_unit_id));

create policy applicants_select on public.applicants for select to authenticated
using (private.has_permission('admissions','view',org_unit_id) or private.has_permission('students','view',org_unit_id));
create policy applicants_insert on public.applicants for insert to authenticated
with check (private.has_permission('admissions','create',org_unit_id));
create policy applicants_update on public.applicants for update to authenticated
using (private.has_permission('admissions','update',org_unit_id))
with check (private.has_permission('admissions','update',org_unit_id));

create policy applicant_documents_select on public.applicant_documents for select to authenticated
using (exists (select 1 from public.applicants a where a.id=applicant_id and private.has_permission('admissions','view',a.org_unit_id)));
create policy applicant_documents_insert on public.applicant_documents for insert to authenticated
with check (exists (select 1 from public.applicants a where a.id=applicant_id and private.has_permission('admissions','create',a.org_unit_id)));

create policy admission_decisions_select on public.admission_decisions for select to authenticated
using (exists (select 1 from public.applicants a where a.id=applicant_id and private.has_permission('admissions','view',a.org_unit_id)));
create policy admission_events_select on public.admission_status_events for select to authenticated
using (exists (select 1 from public.applicants a where a.id=applicant_id and private.has_permission('admissions','view',a.org_unit_id)));

create policy cohorts_select on public.cohorts for select to authenticated
using (private.has_permission('students','view',org_unit_id) or private.has_permission('admissions','view',org_unit_id));
create policy cohorts_insert on public.cohorts for insert to authenticated
with check (private.has_permission('students','create',org_unit_id));
create policy cohorts_update on public.cohorts for update to authenticated
using (private.has_permission('students','update',org_unit_id))
with check (private.has_permission('students','update',org_unit_id));

create policy class_groups_select on public.class_groups for select to authenticated
using (private.has_permission('students','view',org_unit_id));
create policy class_groups_insert on public.class_groups for insert to authenticated
with check (private.has_permission('students','create',org_unit_id));
create policy class_groups_update on public.class_groups for update to authenticated
using (private.has_permission('students','update',org_unit_id))
with check (private.has_permission('students','update',org_unit_id));

create policy students_select on public.students for select to authenticated
using (private.has_permission('students','view',org_unit_id));
create policy students_insert on public.students for insert to authenticated
with check (private.has_permission('students','create',org_unit_id));
create policy students_update on public.students for update to authenticated
using (private.has_permission('students','update',org_unit_id))
with check (private.has_permission('students','update',org_unit_id));

create policy student_enrollments_select on public.student_enrollments for select to authenticated
using (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','view',s.org_unit_id)));
create policy student_enrollments_insert on public.student_enrollments for insert to authenticated
with check (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','create',s.org_unit_id)));
create policy student_enrollments_update on public.student_enrollments for update to authenticated
using (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','update',s.org_unit_id)))
with check (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','update',s.org_unit_id)));

create policy applicant_enrollments_select on public.applicant_enrollments for select to authenticated
using (exists (select 1 from public.applicants a where a.id=applicant_id and private.has_permission('admissions','view',a.org_unit_id)));
create policy student_class_history_select on public.student_class_history for select to authenticated
using (exists (select 1 from public.student_enrollments e join public.students s on s.id=e.student_id where e.id=student_enrollment_id and private.has_permission('students','view',s.org_unit_id)));
create policy student_guardians_select on public.student_guardians for select to authenticated
using (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','view',s.org_unit_id)));
create policy student_guardians_insert on public.student_guardians for insert to authenticated
with check (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','create',s.org_unit_id)));
create policy student_guardians_update on public.student_guardians for update to authenticated
using (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','update',s.org_unit_id)))
with check (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','update',s.org_unit_id)));
create policy student_documents_select on public.student_documents for select to authenticated
using (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','view',s.org_unit_id)));
create policy student_documents_insert on public.student_documents for insert to authenticated
with check (exists (select 1 from public.students s where s.id=student_id and private.has_permission('students','create',s.org_unit_id)));

create or replace function public.decide_applicant(
  p_applicant_id uuid, p_decision text, p_reason text default null
) returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.applicants;
  v_from text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_app from public.applicants where id=p_applicant_id for update;
  if not found then raise exception 'applicant not found'; end if;
  if not private.has_permission('admissions','approve',v_app.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
  if v_app.status not in ('submitted','under_review','needs_update','eligible','waitlisted') then
    raise exception 'invalid applicant state for decision';
  end if;
  if p_decision not in ('eligible','admitted','waitlisted','rejected','needs_update') then raise exception 'invalid decision'; end if;
  if length(pg_catalog.btrim(coalesce(p_reason,''))) > 1000 then raise exception 'reason too long'; end if;
  v_from := v_app.status;
  update public.applicants set status=p_decision, updated_at=now(), updated_by=v_uid where id=p_applicant_id;
  insert into public.admission_decisions(applicant_id,decision,reason,decided_by)
  values(p_applicant_id,p_decision,nullif(pg_catalog.btrim(p_reason),''),v_uid);
  insert into public.admission_status_events(applicant_id,from_status,to_status,reason,actor_id)
  values(p_applicant_id,v_from,p_decision,nullif(pg_catalog.btrim(p_reason),''),v_uid);
  return p_decision;
end $$;

create or replace function public.confirm_applicant_enrollment(
  p_applicant_id uuid, p_cohort_id uuid, p_class_group_id uuid, p_enrollment_date date
) returns table(student_id uuid, student_enrollment_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.applicants;
  v_student_id uuid;
  v_enrollment_id uuid;
  v_cohort public.cohorts;
  v_class public.class_groups;
  v_student_code text;
  v_enrollment_code text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_app from public.applicants where id=p_applicant_id for update;
  if not found then raise exception 'applicant not found'; end if;
  if not private.has_permission('admissions','approve',v_app.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
  if v_app.status <> 'admitted' then raise exception 'applicant must be admitted before enrollment'; end if;
  if exists(select 1 from public.applicant_enrollments ae where ae.applicant_id=p_applicant_id) then
    select s.id,e.id into v_student_id,v_enrollment_id
    from public.applicant_enrollments ae join public.student_enrollments e on e.id=ae.student_enrollment_id
    join public.students s on s.id=e.student_id where ae.applicant_id=p_applicant_id;
    return query select v_student_id,v_enrollment_id; return;
  end if;
  select * into v_cohort from public.cohorts where id=p_cohort_id and org_unit_id=v_app.org_unit_id and status='active';
  if not found then raise exception 'active cohort not found in applicant unit'; end if;
  select * into v_class from public.class_groups where id=p_class_group_id and cohort_id=p_cohort_id and org_unit_id=v_app.org_unit_id and status='active';
  if not found then raise exception 'active class group not found in selected cohort'; end if;
  if p_enrollment_date is null then raise exception 'enrollment date is required'; end if;
  v_student_code := 'HV-' || to_char(current_date,'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  v_enrollment_code := 'NH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  insert into public.students(org_unit_id,student_code,full_name,date_of_birth,gender,national_id,phone,email,address,source_applicant_id,created_by,updated_by)
  values(v_app.org_unit_id,v_student_code,v_app.full_name,v_app.date_of_birth,v_app.gender,v_app.national_id,v_app.phone,v_app.email,v_app.address,p_applicant_id,v_uid,v_uid)
  returning id into v_student_id;
  insert into public.student_enrollments(student_id,cohort_id,class_group_id,enrollment_code,enrollment_date,created_by,updated_by)
  values(v_student_id,p_cohort_id,p_class_group_id,v_enrollment_code,p_enrollment_date,v_uid,v_uid)
  returning id into v_enrollment_id;
  insert into public.applicant_enrollments(applicant_id,student_enrollment_id,confirmed_by)
  values(p_applicant_id,v_enrollment_id,v_uid);
  insert into public.student_class_history(student_enrollment_id,class_group_id,event_type,effective_from,actor_id)
  values(v_enrollment_id,p_class_group_id,'assigned',p_enrollment_date,v_uid);
  update public.applicants set status='enrolled',updated_at=now(),updated_by=v_uid where id=p_applicant_id;
  insert into public.admission_status_events(applicant_id,from_status,to_status,reason,actor_id)
  values(p_applicant_id,'admitted','enrolled','Xác nhận nhập học',v_uid);
  return query select v_student_id,v_enrollment_id;
end $$;

revoke all on function public.decide_applicant(uuid,text,text) from public, anon;
grant execute on function public.decide_applicant(uuid,text,text) to authenticated;
revoke all on function public.confirm_applicant_enrollment(uuid,uuid,uuid,date) from public, anon;
grant execute on function public.confirm_applicant_enrollment(uuid,uuid,uuid,date) to authenticated;

grant select, insert, update on public.admission_campaigns, public.applicants, public.applicant_documents,
  public.cohorts, public.class_groups, public.students, public.student_enrollments,
  public.student_guardians, public.student_documents to authenticated;
grant select on public.admission_decisions, public.admission_status_events, public.applicant_enrollments, public.student_class_history to authenticated;

comment on table public.applicants is 'Hồ sơ thí sinh tuyển sinh; dữ liệu cá nhân nhạy cảm, truy cập theo admissions permission và phạm vi đơn vị.';
comment on table public.students is 'Hồ sơ người học gốc; truy cập theo students permission và phạm vi đơn vị.';
comment on table public.applicant_documents is 'Metadata giấy tờ tuyển sinh; object_path phải trỏ tới private Storage bucket.';
comment on table public.student_documents is 'Metadata giấy tờ người học; object_path phải trỏ tới private Storage bucket.';

commit;
