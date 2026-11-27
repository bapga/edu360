begin;

create or replace function public.create_student_enrollment(
  p_student_id uuid, p_cohort_id uuid, p_class_group_id uuid, p_enrollment_date date
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_student public.students;
  v_cohort public.cohorts;
  v_class public.class_groups;
  v_id uuid;
  v_code text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_student from public.students where id=p_student_id;
  if not found then raise exception 'student not found'; end if;
  if not private.has_permission('students','create',v_student.org_unit_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;
  select * into v_cohort from public.cohorts where id=p_cohort_id and org_unit_id=v_student.org_unit_id and status='active';
  if not found then raise exception 'active cohort not found in student unit'; end if;
  select * into v_class from public.class_groups where id=p_class_group_id and cohort_id=p_cohort_id and org_unit_id=v_student.org_unit_id and status='active';
  if not found then raise exception 'active class group not found in selected cohort'; end if;
  if p_enrollment_date is null then raise exception 'enrollment date is required'; end if;
  v_code := 'NH-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  insert into public.student_enrollments(student_id,cohort_id,class_group_id,enrollment_code,enrollment_date,created_by,updated_by)
  values(p_student_id,p_cohort_id,p_class_group_id,v_code,p_enrollment_date,v_uid,v_uid)
  returning id into v_id;
  insert into public.student_class_history(student_enrollment_id,class_group_id,event_type,effective_from,actor_id)
  values(v_id,p_class_group_id,'assigned',p_enrollment_date,v_uid);
  return v_id;
end
$$;

revoke insert, update on public.student_enrollments from authenticated;
grant select on public.student_enrollments to authenticated;
revoke all on function public.create_student_enrollment(uuid,uuid,uuid,date) from public, anon;
grant execute on function public.create_student_enrollment(uuid,uuid,uuid,date) to authenticated;

commit;
