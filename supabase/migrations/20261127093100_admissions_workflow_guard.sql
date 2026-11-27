begin;

create or replace function private.guard_applicant_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.workflow_transition', true), '') <> 'on' then
    raise exception 'Applicant status must be changed through an approved workflow RPC'
      using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists applicants_status_workflow_guard on public.applicants;
create trigger applicants_status_workflow_guard
before update of status on public.applicants
for each row execute function private.guard_applicant_status_transition();

create or replace function public.submit_applicant(p_applicant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.applicants;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_app from public.applicants where id=p_applicant_id for update;
  if not found then raise exception 'applicant not found'; end if;
  if not private.has_permission('admissions','update',v_app.org_unit_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;
  if v_app.status <> 'draft' and v_app.status <> 'needs_update' then
    raise exception 'only draft or needs_update applications can be submitted';
  end if;
  perform pg_catalog.set_config('app.workflow_transition','on',true);
  update public.applicants
    set status='submitted', submitted_at=coalesce(submitted_at,now()), updated_at=now(), updated_by=v_uid
    where id=p_applicant_id;
  insert into public.admission_status_events(applicant_id,from_status,to_status,reason,actor_id)
    values(p_applicant_id,v_app.status,'submitted',null,v_uid);
  return 'submitted';
end
$$;

create or replace function public.decide_applicant(
  p_applicant_id uuid, p_decision text, p_reason text default null
) returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.applicants;
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
  perform pg_catalog.set_config('app.workflow_transition','on',true);
  update public.applicants set status=p_decision, updated_at=now(), updated_by=v_uid where id=p_applicant_id;
  insert into public.admission_decisions(applicant_id,decision,reason,decided_by)
  values(p_applicant_id,p_decision,nullif(pg_catalog.btrim(p_reason),''),v_uid);
  insert into public.admission_status_events(applicant_id,from_status,to_status,reason,actor_id)
  values(p_applicant_id,v_app.status,p_decision,nullif(pg_catalog.btrim(p_reason),''),v_uid);
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
  perform pg_catalog.set_config('app.workflow_transition','on',true);
  update public.applicants set status='enrolled',updated_at=now(),updated_by=v_uid where id=p_applicant_id;
  insert into public.admission_status_events(applicant_id,from_status,to_status,reason,actor_id)
  values(p_applicant_id,'admitted','enrolled','Xác nhận nhập học',v_uid);
  return query select v_student_id,v_enrollment_id;
end $$;

revoke all on function public.submit_applicant(uuid) from public, anon;
grant execute on function public.submit_applicant(uuid) to authenticated;
revoke all on function public.decide_applicant(uuid,text,text) from public, anon;
grant execute on function public.decide_applicant(uuid,text,text) to authenticated;
revoke all on function public.confirm_applicant_enrollment(uuid,uuid,uuid,date) from public, anon;
grant execute on function public.confirm_applicant_enrollment(uuid,uuid,uuid,date) to authenticated;

commit;
