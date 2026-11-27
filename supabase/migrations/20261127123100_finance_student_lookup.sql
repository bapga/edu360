begin;
create or replace function public.get_finance_student_lookup()
returns table(student_id uuid,enrollment_id uuid,org_unit_id uuid,student_code text,full_name text,class_group_id uuid)
language plpgsql security definer set search_path=''
as $function$
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 return query
 select s.id,e.id,s.org_unit_id,s.student_code,s.full_name,e.class_group_id
 from public.students s
 join public.student_enrollments e on e.student_id=s.id
 where s.status='active' and e.status='studying'
  and private.has_permission('finance','view',s.org_unit_id)
 order by s.student_code;
end;
$function$;

create or replace function public.create_student_invoice(
 p_student_id uuid,
 p_enrollment_id uuid,
 p_invoice_no text,
 p_issue_date date,
 p_due_date date,
 p_note text
)
returns uuid
language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_unit uuid; v_invoice uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_invoice_no,'')))=0 then raise exception 'invoice number is required'; end if;
 select s.org_unit_id into v_unit
 from public.students s join public.student_enrollments e on e.student_id=s.id
 where s.id=p_student_id and e.id=p_enrollment_id and s.status='active' and e.status='studying';
 if not found then raise exception 'active student enrollment not found'; end if;
 if not private.has_permission('finance','create',v_unit) then raise exception 'not allowed' using errcode='42501'; end if;
 insert into public.student_invoices(org_unit_id,student_id,enrollment_id,invoice_no,issue_date,due_date,note,created_by)
 values(v_unit,p_student_id,p_enrollment_id,btrim(p_invoice_no),coalesce(p_issue_date,current_date),p_due_date,left(coalesce(p_note,''),2000),v_uid)
 returning id into v_invoice;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,'create_student_invoice','student_invoices',v_invoice::text,jsonb_build_object('invoice_no',btrim(p_invoice_no),'student_id',p_student_id));
 return v_invoice;
end;
$function$;
revoke all on function public.get_finance_student_lookup() from public,anon;
revoke all on function public.create_student_invoice(uuid,uuid,text,date,date,text) from public,anon;
grant execute on function public.get_finance_student_lookup() to authenticated;
grant execute on function public.create_student_invoice(uuid,uuid,text,date,date,text) to authenticated;
commit;