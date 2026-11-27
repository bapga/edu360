begin;

create table public.fee_catalog (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 fee_code text not null,
 fee_name text not null,
 fee_type text not null check(fee_type in ('tuition','admission','service','material','other')),
 unit_price numeric(14,2) not null check(unit_price>=0),
 valid_from date,
 valid_to date,
 is_active boolean not null default true,
 note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid default auth.uid() references auth.users(id),
 updated_by uuid references auth.users(id),
 unique(org_unit_id,fee_code),
 check(valid_to is null or valid_from is null or valid_to>=valid_from)
);

create table public.student_invoices (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 student_id uuid not null references public.students(id),
 enrollment_id uuid not null references public.student_enrollments(id),
 invoice_no text not null,
 issue_date date not null default current_date,
 due_date date,
 status text not null default 'draft' check(status in ('draft','issued','partially_paid','paid','cancelled')),
 total_amount numeric(14,2) not null default 0 check(total_amount>=0),
 note text,
 created_by uuid not null default auth.uid() references auth.users(id),
 issued_by uuid references auth.users(id),
 issued_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(org_unit_id,invoice_no),
 check(due_date is null or due_date>=issue_date)
);

create table public.invoice_lines (
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references public.student_invoices(id),
 fee_item_id uuid not null references public.fee_catalog(id),
 description text not null,
 quantity numeric(12,2) not null default 1 check(quantity>0),
 unit_price numeric(14,2) not null check(unit_price>=0),
 line_total numeric(16,2) generated always as (round(quantity*unit_price,2)) stored,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(invoice_id,fee_item_id)
);

create table public.payment_receipts (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 invoice_id uuid not null references public.student_invoices(id),
 receipt_no text not null,
 amount numeric(14,2) not null check(amount>0),
 payment_method text not null check(payment_method in ('cash','bank_transfer','card','other')),
 paid_at timestamptz not null default now(),
 reference_no text,
 status text not null default 'pending' check(status in ('pending','confirmed','reversed')),
 recorded_by uuid not null default auth.uid() references auth.users(id),
 confirmed_by uuid references auth.users(id),
 confirmed_at timestamptz,
 note text,
 created_at timestamptz not null default now(),
 unique(org_unit_id,receipt_no)
);

create table public.expense_requests (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 expense_no text not null,
 category text not null,
 description text not null,
 vendor text,
 amount numeric(14,2) not null check(amount>0),
 incurred_on date not null default current_date,
 status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','paid')),
 created_by uuid not null default auth.uid() references auth.users(id),
 submitted_at timestamptz,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 paid_by uuid references auth.users(id),
 paid_at timestamptz,
 decision_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(org_unit_id,expense_no)
);

create index fee_catalog_unit_active_idx on public.fee_catalog(org_unit_id,is_active);
create index student_invoices_student_status_idx on public.student_invoices(student_id,status);
create index student_invoices_unit_date_idx on public.student_invoices(org_unit_id,issue_date,status);
create index invoice_lines_invoice_idx on public.invoice_lines(invoice_id);
create index payment_receipts_invoice_status_idx on public.payment_receipts(invoice_id,status);
create index expense_requests_unit_status_idx on public.expense_requests(org_unit_id,status,incurred_on);

alter table public.fee_catalog enable row level security;
alter table public.student_invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.expense_requests enable row level security;

create policy fee_catalog_select on public.fee_catalog for select to authenticated
 using(private.has_permission('finance','view',org_unit_id));
create policy fee_catalog_insert on public.fee_catalog for insert to authenticated
 with check(private.has_permission('finance','create',org_unit_id) and created_by=auth.uid());
create policy fee_catalog_update on public.fee_catalog for update to authenticated
 using(private.has_permission('finance','update',org_unit_id))
 with check(private.has_permission('finance','update',org_unit_id));

create policy student_invoices_select on public.student_invoices for select to authenticated
 using(private.has_permission('finance','view',org_unit_id));
create policy student_invoices_insert on public.student_invoices for insert to authenticated
 with check(status='draft' and created_by=auth.uid() and private.has_permission('finance','create',org_unit_id)
  and exists(select 1 from public.students s where s.id=student_id and s.org_unit_id=student_invoices.org_unit_id)
  and exists(select 1 from public.student_enrollments e where e.id=enrollment_id and e.student_id=student_id and e.status='studying'));
create policy student_invoices_update on public.student_invoices for update to authenticated
 using(status='draft' and private.has_permission('finance','update',org_unit_id))
 with check(status='draft' and private.has_permission('finance','update',org_unit_id));

create policy invoice_lines_select on public.invoice_lines for select to authenticated
 using(exists(select 1 from public.student_invoices i where i.id=invoice_id and private.has_permission('finance','view',i.org_unit_id)));
create policy invoice_lines_insert on public.invoice_lines for insert to authenticated
 with check(exists(select 1 from public.student_invoices i join public.fee_catalog f on f.id=fee_item_id
  where i.id=invoice_id and i.status='draft' and i.org_unit_id=f.org_unit_id and private.has_permission('finance','create',i.org_unit_id)));
create policy invoice_lines_update on public.invoice_lines for update to authenticated
 using(exists(select 1 from public.student_invoices i where i.id=invoice_id and i.status='draft' and private.has_permission('finance','update',i.org_unit_id)))
 with check(exists(select 1 from public.student_invoices i join public.fee_catalog f on f.id=fee_item_id
  where i.id=invoice_id and i.status='draft' and i.org_unit_id=f.org_unit_id and private.has_permission('finance','update',i.org_unit_id)));

create policy payment_receipts_select on public.payment_receipts for select to authenticated
 using(private.has_permission('finance','view',org_unit_id));
create policy payment_receipts_insert on public.payment_receipts for insert to authenticated
 with check(status='pending' and recorded_by=auth.uid() and private.has_permission('finance','create',org_unit_id)
  and exists(select 1 from public.student_invoices i where i.id=invoice_id and i.org_unit_id=payment_receipts.org_unit_id and i.status in ('issued','partially_paid')));

create policy expense_requests_select on public.expense_requests for select to authenticated
 using(private.has_permission('finance','view',org_unit_id));
create policy expense_requests_insert on public.expense_requests for insert to authenticated
 with check(status='draft' and created_by=auth.uid() and private.has_permission('finance','create',org_unit_id));
create policy expense_requests_update on public.expense_requests for update to authenticated
 using(status='draft' and private.has_permission('finance','update',org_unit_id))
 with check(status='draft' and private.has_permission('finance','update',org_unit_id));

create or replace function private.recalculate_invoice_total()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_invoice uuid;
begin
 v_invoice:=coalesce(new.invoice_id,old.invoice_id);
 update public.student_invoices i
 set total_amount=coalesce((select sum(l.line_total) from public.invoice_lines l where l.invoice_id=v_invoice),0),
  updated_at=now()
 where i.id=v_invoice and i.status='draft';
 return coalesce(new,old);
end;
$function$;
create trigger invoice_lines_recalculate
after insert or update or delete on public.invoice_lines
for each row execute function private.recalculate_invoice_total();

create or replace function private.validate_invoice_line()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_invoice public.student_invoices; v_fee public.fee_catalog;
begin
 select * into v_invoice from public.student_invoices where id=new.invoice_id;
 select * into v_fee from public.fee_catalog where id=new.fee_item_id;
 if v_invoice.id is null or v_fee.id is null or v_invoice.org_unit_id<>v_fee.org_unit_id then
  raise exception 'invoice and fee item must belong to the same unit';
 end if;
 if v_invoice.status<>'draft' then raise exception 'invoice is not editable'; end if;
 if not v_fee.is_active then raise exception 'fee item is inactive'; end if;
 return new;
end;
$function$;
create trigger invoice_line_validate before insert or update on public.invoice_lines
for each row execute function private.validate_invoice_line();

create or replace function public.issue_student_invoice(p_invoice_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_invoice public.student_invoices;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'issue reason must contain at least 5 characters'; end if;
 select * into v_invoice from public.student_invoices where id=p_invoice_id for update;
 if not found then raise exception 'invoice not found'; end if;
 if not private.has_permission('finance','approve',v_invoice.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_invoice.status<>'draft' or v_invoice.total_amount<=0 then raise exception 'invoice is not ready to issue'; end if;
 if v_invoice.created_by=v_uid then raise exception 'creator cannot issue own invoice'; end if;
 update public.student_invoices set status='issued',issued_by=v_uid,issued_at=now(),updated_at=now() where id=p_invoice_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,'issue_student_invoice','student_invoices',p_invoice_id::text,jsonb_build_object('reason',btrim(p_reason),'total_amount',v_invoice.total_amount));
end;
$function$;

create or replace function public.confirm_payment_receipt(p_receipt_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_receipt public.payment_receipts; v_invoice public.student_invoices; v_paid numeric;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'confirmation reason must contain at least 5 characters'; end if;
 select * into v_receipt from public.payment_receipts where id=p_receipt_id for update;
 if not found then raise exception 'receipt not found'; end if;
 select * into v_invoice from public.student_invoices where id=v_receipt.invoice_id for update;
 if not private.has_permission('finance','approve',v_receipt.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_receipt.status<>'pending' then raise exception 'receipt is not pending'; end if;
 if v_receipt.recorded_by=v_uid then raise exception 'recorder cannot confirm own receipt'; end if;
 select coalesce(sum(amount),0) into v_paid from public.payment_receipts
 where invoice_id=v_invoice.id and status='confirmed';
 if v_paid+v_receipt.amount>v_invoice.total_amount then raise exception 'confirmed payments would exceed invoice amount'; end if;
 update public.payment_receipts set status='confirmed',confirmed_by=v_uid,confirmed_at=now(),note=concat_ws(E'\n',note,'Xác nhận: '||btrim(p_reason)) where id=p_receipt_id;
 v_paid:=v_paid+v_receipt.amount;
 update public.student_invoices set status=case when v_paid>=total_amount then 'paid' else 'partially_paid' end,updated_at=now()
 where id=v_invoice.id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,'confirm_payment_receipt','payment_receipts',p_receipt_id::text,jsonb_build_object('invoice_id',v_invoice.id,'amount',v_receipt.amount,'reason',btrim(p_reason)));
end;
$function$;

create or replace function public.submit_expense_request(p_expense_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_expense public.expense_requests;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_expense from public.expense_requests where id=p_expense_id for update;
 if not found then raise exception 'expense request not found'; end if;
 if not private.has_permission('finance','update',v_expense.org_unit_id)
  and not (v_expense.created_by=v_uid and private.has_permission('finance','create',v_expense.org_unit_id)) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_expense.status<>'draft' then raise exception 'expense request is not draft'; end if;
 update public.expense_requests set status='submitted',submitted_at=now(),updated_at=now() where id=p_expense_id;
end;
$function$;

create or replace function public.decide_expense_request(p_expense_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_expense public.expense_requests;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_note,'')))<5 then raise exception 'decision note must contain at least 5 characters'; end if;
 select * into v_expense from public.expense_requests where id=p_expense_id for update;
 if not found then raise exception 'expense request not found'; end if;
 if not private.has_permission('finance','approve',v_expense.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_expense.status<>'submitted' then raise exception 'expense request is not awaiting approval'; end if;
 if v_expense.created_by=v_uid then raise exception 'requester cannot approve own expense'; end if;
 update public.expense_requests set status=case when p_approve then 'approved' else 'rejected' end,
  approved_by=case when p_approve then v_uid else null end,approved_at=case when p_approve then now() else null end,
  decision_note=left(btrim(p_note),2000),updated_at=now() where id=p_expense_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,case when p_approve then 'approve_expense' else 'reject_expense' end,'expense_requests',p_expense_id::text,
  jsonb_build_object('reason',left(btrim(p_note),2000),'amount',v_expense.amount));
end;
$function$;

create or replace function public.mark_expense_paid(p_expense_id uuid,p_payment_reference text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_expense public.expense_requests;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_expense from public.expense_requests where id=p_expense_id for update;
 if not found then raise exception 'expense request not found'; end if;
 if not private.has_permission('finance','approve',v_expense.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_expense.status<>'approved' then raise exception 'only approved expenses can be paid'; end if;
 update public.expense_requests set status='paid',paid_by=v_uid,paid_at=now(),
  decision_note=concat_ws(E'\n',decision_note,'Thanh toán: '||left(coalesce(p_payment_reference,''),300)),updated_at=now()
 where id=p_expense_id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,'mark_expense_paid','expense_requests',p_expense_id::text,jsonb_build_object('amount',v_expense.amount,'reference',left(coalesce(p_payment_reference,''),300)));
end;
$function$;

revoke all on function public.issue_student_invoice(uuid,text) from public,anon;
revoke all on function public.confirm_payment_receipt(uuid,text) from public,anon;
revoke all on function public.submit_expense_request(uuid) from public,anon;
revoke all on function public.decide_expense_request(uuid,boolean,text) from public,anon;
revoke all on function public.mark_expense_paid(uuid,text) from public,anon;
grant execute on function public.issue_student_invoice(uuid,text) to authenticated;
grant execute on function public.confirm_payment_receipt(uuid,text) to authenticated;
grant execute on function public.submit_expense_request(uuid) to authenticated;
grant execute on function public.decide_expense_request(uuid,boolean,text) to authenticated;
grant execute on function public.mark_expense_paid(uuid,text) to authenticated;

grant select,insert,update on public.fee_catalog,public.student_invoices,public.invoice_lines,public.payment_receipts,public.expense_requests to authenticated;

create or replace function public.reports_summary()
returns table(metric_code text,metric_label text,metric_value bigint,availability text,as_of timestamptz)
language plpgsql stable security definer set search_path=''
as $function$
begin
 if not private.has_permission('reports','view') then
  raise exception 'not allowed to view reports' using errcode='42501';
 end if;
 return query
 select 'active_org_units'::text,'Đơn vị đang hoạt động'::text,count(*)::bigint,'available'::text,now()
 from public.org_units where is_active and deleted_at is null
 union all
 select 'active_staff','Nhân sự đang công tác',count(*)::bigint,'available',now()
 from public.staff where status='active' and deleted_at is null
 union all
 select 'active_staff_assignments','Phân công công tác đang hiệu lực',count(*)::bigint,'available',now()
 from public.staff_assignments where status='active' and (end_date is null or end_date>=current_date)
 union all
 select 'active_students','Người học đang học',count(*)::bigint,'available',now()
 from public.students where status='active'
 union all
 select 'admissions','Hồ sơ tuyển sinh',count(*)::bigint,'available',now()
 from public.applicants where status not in ('withdrawn')
 union all
 select 'training_results','Kết quả đào tạo và điểm',null::bigint,'not_available',now()
 union all
 select 'issued_invoices','Hóa đơn đã phát hành',count(*)::bigint,'available',now()
 from public.student_invoices where status in ('issued','partially_paid','paid')
 union all
 select 'outstanding_receivables_vnd','Công nợ phải thu (đồng)',
  coalesce(sum(i.total_amount-coalesce(p.paid,0)),0)::bigint,'available',now()
 from public.student_invoices i
 left join (select invoice_id,sum(amount) paid from public.payment_receipts where status='confirmed' group by invoice_id) p on p.invoice_id=i.id
 where i.status in ('issued','partially_paid')
 union all
 select 'pending_expenses','Đề nghị chi chờ xử lý',count(*)::bigint,'available',now()
 from public.expense_requests where status in ('submitted','approved')
 ;
end
$function$;

commit;
