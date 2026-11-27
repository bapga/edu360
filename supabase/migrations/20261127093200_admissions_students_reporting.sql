begin;

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
  select 'active_students'::text, 'Người học đang học'::text, count(*)::bigint, 'available'::text, now()
  from public.students where status = 'active'
  union all
  select 'admissions'::text, 'Hồ sơ tuyển sinh'::text, count(*)::bigint, 'available'::text, now()
  from public.applicants where status not in ('withdrawn')
  union all
  select 'training_results'::text, 'Kết quả đào tạo và điểm'::text, null::bigint, 'not_available'::text, now();
end
$function$;

revoke all on function public.reports_summary() from public, anon;
grant execute on function public.reports_summary() to authenticated;

commit;
