begin;

create table public.asset_categories (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 category_code text not null,
 category_name text not null,
 description text,
 is_active boolean not null default true,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(org_unit_id,category_code)
);

create table public.assets (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 category_id uuid not null references public.asset_categories(id),
 asset_code text not null,
 asset_name text not null,
 serial_number text,
 purchase_date date,
 purchase_cost numeric(14,2) check(purchase_cost is null or purchase_cost>=0),
 warranty_end date,
 location text,
 status text not null default 'available' check(status in ('available','assigned','maintenance','disposed','lost')),
 condition text not null default 'good' check(condition in ('new','good','fair','poor')),
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(org_unit_id,asset_code),
 check(warranty_end is null or purchase_date is null or warranty_end>=purchase_date)
);

create table public.asset_assignments (
 id uuid primary key default gen_random_uuid(),
 asset_id uuid not null references public.assets(id),
 staff_id uuid not null references public.staff(id),
 assigned_at date not null default current_date,
 due_date date,
 returned_at date,
 status text not null default 'active' check(status in ('active','returned')),
 assigned_by uuid not null references auth.users(id),
 returned_by uuid references auth.users(id),
 return_condition text check(return_condition is null or return_condition in ('new','good','fair','poor')),
 assignment_note text,
 return_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(due_date is null or due_date>=assigned_at),
 check(returned_at is null or returned_at>=assigned_at)
);

create table public.asset_maintenance (
 id uuid primary key default gen_random_uuid(),
 asset_id uuid not null references public.assets(id),
 maintenance_type text not null check(maintenance_type in ('repair','inspection','service','calibration','other')),
 issue_description text not null,
 reported_at date not null default current_date,
 estimated_cost numeric(14,2) check(estimated_cost is null or estimated_cost>=0),
 actual_cost numeric(14,2) check(actual_cost is null or actual_cost>=0),
 status text not null default 'reported' check(status in ('reported','approved','rejected','in_progress','completed')),
 previous_asset_status text check(previous_asset_status is null or previous_asset_status in ('available','assigned')),
 created_by uuid not null default auth.uid() references auth.users(id),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 completed_by uuid references auth.users(id),
 completed_at timestamptz,
 decision_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.asset_movements (
 id uuid primary key default gen_random_uuid(),
 asset_id uuid not null references public.assets(id),
 movement_type text not null check(movement_type in ('assigned','returned','maintenance_started','maintenance_completed','transfer','disposed','adjusted')),
 movement_date date not null default current_date,
 from_location text,
 to_location text,
 from_status text,
 to_status text,
 reference_id uuid,
 note text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);

create unique index asset_assignments_one_active_idx on public.asset_assignments(asset_id) where status='active';
create index assets_unit_status_idx on public.assets(org_unit_id,status,category_id);
create index assets_category_idx on public.assets(category_id);
create index asset_assignments_staff_idx on public.asset_assignments(staff_id,status);
create index asset_maintenance_asset_status_idx on public.asset_maintenance(asset_id,status);
create index asset_movements_asset_date_idx on public.asset_movements(asset_id,movement_date desc);

alter table public.asset_categories enable row level security;
alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.asset_maintenance enable row level security;
alter table public.asset_movements enable row level security;

create policy asset_categories_select on public.asset_categories for select to authenticated
 using(private.has_permission('assets','view',org_unit_id));
create policy asset_categories_insert on public.asset_categories for insert to authenticated
 with check(private.has_permission('assets','create',org_unit_id) and created_by=auth.uid());
create policy asset_categories_update on public.asset_categories for update to authenticated
 using(private.has_permission('assets','update',org_unit_id))
 with check(private.has_permission('assets','update',org_unit_id));

create policy assets_select on public.assets for select to authenticated
 using(private.has_permission('assets','view',org_unit_id));
create policy assets_insert on public.assets for insert to authenticated
 with check(status='available' and created_by=auth.uid()
  and private.has_permission('assets','create',org_unit_id)
  and exists(select 1 from public.asset_categories c where c.id=category_id and c.org_unit_id=assets.org_unit_id));
create policy assets_update on public.assets for update to authenticated
 using(private.has_permission('assets','update',org_unit_id))
 with check(private.has_permission('assets','update',org_unit_id)
  and exists(select 1 from public.asset_categories c where c.id=category_id and c.org_unit_id=assets.org_unit_id));

create policy asset_assignments_select on public.asset_assignments for select to authenticated
 using(exists(select 1 from public.assets a where a.id=asset_id and private.has_permission('assets','view',a.org_unit_id)));
create policy asset_maintenance_select on public.asset_maintenance for select to authenticated
 using(exists(select 1 from public.assets a where a.id=asset_id and private.has_permission('assets','view',a.org_unit_id)));
create policy asset_maintenance_insert on public.asset_maintenance for insert to authenticated
 with check(status='reported' and created_by=auth.uid()
  and exists(select 1 from public.assets a where a.id=asset_id and a.status in ('available','assigned')
   and (private.has_permission('assets','create',a.org_unit_id) or private.has_permission('assets','update',a.org_unit_id))));
create policy asset_movements_select on public.asset_movements for select to authenticated
 using(exists(select 1 from public.assets a where a.id=asset_id and private.has_permission('assets','view',a.org_unit_id)));

create or replace function private.guard_asset_status_change()
returns trigger language plpgsql set search_path=''
as $function$
begin
 if new.status is distinct from old.status and coalesce(current_setting('app.asset_workflow',true),'')<>'on' then
  raise exception 'asset status can only change through approved asset workflows';
 end if;
 return new;
end;
$function$;
create trigger asset_status_guard before update on public.assets
for each row execute function private.guard_asset_status_change();

create or replace function private.validate_asset_assignment()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_asset public.assets; v_staff public.staff;
begin
 select * into v_asset from public.assets where id=new.asset_id;
 select * into v_staff from public.staff where id=new.staff_id and status='active' and deleted_at is null;
 if v_asset.id is null or v_staff.id is null then raise exception 'asset or active staff record not found'; end if;
 if not exists(select 1 from public.staff_assignments sa where sa.staff_id=new.staff_id and sa.org_unit_id=v_asset.org_unit_id
  and sa.status='active' and sa.start_date<=new.assigned_at and (sa.end_date is null or sa.end_date>=coalesce(new.due_date,new.assigned_at))) then
  raise exception 'staff must have an active assignment in the asset unit for the assignment period';
 end if;
 return new;
end;
$function$;
create trigger asset_assignment_validate before insert or update on public.asset_assignments
for each row execute function private.validate_asset_assignment();

create or replace function public.get_asset_staff_lookup()
returns table(staff_id uuid,org_unit_id uuid,staff_code text,full_name text)
language plpgsql security definer set search_path=''
as $function$
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 return query
 select distinct s.id,sa.org_unit_id,s.staff_code,s.full_name
 from public.staff s join public.staff_assignments sa on sa.staff_id=s.id
 where s.status='active' and s.deleted_at is null and sa.status='active'
  and (sa.end_date is null or sa.end_date>=current_date)
  and private.has_permission('assets','view',sa.org_unit_id)
 order by s.full_name;
end;
$function$;

create or replace function public.assign_asset(p_asset_id uuid,p_staff_id uuid,p_assigned_at date,p_due_date date,p_note text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_asset public.assets; v_assignment uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_asset from public.assets where id=p_asset_id for update;
 if not found then raise exception 'asset not found'; end if;
 if not private.has_permission('assets','update',v_asset.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_asset.status<>'available' then raise exception 'asset is not available'; end if;
 perform set_config('app.asset_workflow','on',true);
 insert into public.asset_assignments(asset_id,staff_id,assigned_at,due_date,status,assigned_by,assignment_note)
 values(p_asset_id,p_staff_id,coalesce(p_assigned_at,current_date),p_due_date,'active',v_uid,left(coalesce(p_note,''),2000))
 returning id into v_assignment;
 update public.assets set status='assigned',updated_by=v_uid,updated_at=now() where id=p_asset_id;
 insert into public.asset_movements(asset_id,movement_type,movement_date,from_location,to_location,from_status,to_status,reference_id,note,created_by)
 values(p_asset_id,'assigned',coalesce(p_assigned_at,current_date),v_asset.location,v_asset.location,'available','assigned',v_assignment,left(coalesce(p_note,''),2000),v_uid);
 return v_assignment;
end;
$function$;

create or replace function public.return_asset(p_assignment_id uuid,p_returned_at date,p_condition text,p_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_assignment public.asset_assignments; v_asset public.assets;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_assignment from public.asset_assignments where id=p_assignment_id for update;
 if not found or v_assignment.status<>'active' then raise exception 'active asset assignment not found'; end if;
 select * into v_asset from public.assets where id=v_assignment.asset_id for update;
 if not private.has_permission('assets','update',v_asset.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_asset.status<>'assigned' then raise exception 'asset is not in assigned status'; end if;
 if p_condition not in ('new','good','fair','poor') then raise exception 'invalid return condition'; end if;
 perform set_config('app.asset_workflow','on',true);
 update public.asset_assignments set status='returned',returned_at=coalesce(p_returned_at,current_date),returned_by=v_uid,
  return_condition=p_condition,return_note=left(coalesce(p_note,''),2000),updated_at=now() where id=p_assignment_id;
 update public.assets set status='available',condition=p_condition,updated_by=v_uid,updated_at=now() where id=v_asset.id;
 insert into public.asset_movements(asset_id,movement_type,movement_date,from_location,to_location,from_status,to_status,reference_id,note,created_by)
 values(v_asset.id,'returned',coalesce(p_returned_at,current_date),v_asset.location,v_asset.location,'assigned','available',p_assignment_id,left(coalesce(p_note,''),2000),v_uid);
end;
$function$;

create or replace function public.decide_asset_maintenance(p_maintenance_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_job public.asset_maintenance; v_asset public.assets;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_note,'')))<5 then raise exception 'decision note must contain at least 5 characters'; end if;
 select * into v_job from public.asset_maintenance where id=p_maintenance_id for update;
 if not found or v_job.status<>'reported' then raise exception 'maintenance request is not awaiting approval'; end if;
 select * into v_asset from public.assets where id=v_job.asset_id for update;
 if not private.has_permission('assets','approve',v_asset.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_job.created_by=v_uid then raise exception 'requester cannot approve own maintenance request'; end if;
 if p_approve then
  if v_asset.status not in ('available','assigned') then raise exception 'asset cannot enter maintenance from current status'; end if;
  perform set_config('app.asset_workflow','on',true);
  update public.assets set status='maintenance',updated_by=v_uid,updated_at=now() where id=v_asset.id;
 end if;
 update public.asset_maintenance set status=case when p_approve then 'approved' else 'rejected' end,
  previous_asset_status=case when p_approve then v_asset.status else null end,
  approved_by=case when p_approve then v_uid else null end,approved_at=case when p_approve then now() else null end,
  decision_note=left(btrim(p_note),2000),updated_at=now() where id=p_maintenance_id;
 insert into public.asset_movements(asset_id,movement_type,movement_date,from_location,to_location,from_status,to_status,reference_id,note,created_by)
 values(v_asset.id,case when p_approve then 'maintenance_started' else 'adjusted' end,current_date,v_asset.location,v_asset.location,v_asset.status,
  case when p_approve then 'maintenance' else v_asset.status end,p_maintenance_id,left(btrim(p_note),2000),v_uid);
end;
$function$;

create or replace function public.complete_asset_maintenance(p_maintenance_id uuid,p_actual_cost numeric,p_condition text,p_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_job public.asset_maintenance; v_asset public.assets; v_next text;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_job from public.asset_maintenance where id=p_maintenance_id for update;
 if not found or v_job.status not in ('approved','in_progress') then raise exception 'maintenance is not ready to complete'; end if;
 select * into v_asset from public.assets where id=v_job.asset_id for update;
 if not private.has_permission('assets','update',v_asset.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if p_actual_cost is not null and p_actual_cost<0 then raise exception 'actual cost cannot be negative'; end if;
 if p_condition not in ('new','good','fair','poor') then raise exception 'invalid asset condition'; end if;
 v_next:=case when v_job.previous_asset_status='assigned' then 'assigned' else 'available' end;
 perform set_config('app.asset_workflow','on',true);
 update public.assets set status=v_next,condition=p_condition,updated_by=v_uid,updated_at=now() where id=v_asset.id;
 update public.asset_maintenance set status='completed',actual_cost=p_actual_cost,completed_by=v_uid,completed_at=now(),
  decision_note=concat_ws(E'\n',decision_note,left(coalesce(p_note,''),2000)),updated_at=now() where id=p_maintenance_id;
 insert into public.asset_movements(asset_id,movement_type,movement_date,from_location,to_location,from_status,to_status,reference_id,note,created_by)
 values(v_asset.id,'maintenance_completed',current_date,v_asset.location,v_asset.location,'maintenance',v_next,p_maintenance_id,left(coalesce(p_note,''),2000),v_uid);
end;
$function$;

revoke all on function public.get_asset_staff_lookup() from public,anon;
revoke all on function public.assign_asset(uuid,uuid,date,date,text) from public,anon;
revoke all on function public.return_asset(uuid,date,text,text) from public,anon;
revoke all on function public.decide_asset_maintenance(uuid,boolean,text) from public,anon;
revoke all on function public.complete_asset_maintenance(uuid,numeric,text,text) from public,anon;
grant execute on function public.get_asset_staff_lookup() to authenticated;
grant execute on function public.assign_asset(uuid,uuid,date,date,text) to authenticated;
grant execute on function public.return_asset(uuid,date,text,text) to authenticated;
grant execute on function public.decide_asset_maintenance(uuid,boolean,text) to authenticated;
grant execute on function public.complete_asset_maintenance(uuid,numeric,text,text) to authenticated;

grant select,insert,update on public.asset_categories,public.assets to authenticated;
grant select,insert on public.asset_maintenance to authenticated;
grant select on public.asset_assignments,public.asset_movements to authenticated;

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
 union all
 select 'assets_total','Tổng số tài sản',count(*)::bigint,'available',now()
 from public.assets where status<>'disposed'
 union all
 select 'assets_assigned','Tài sản đang bàn giao',count(*)::bigint,'available',now()
 from public.assets where status='assigned'
 union all
 select 'assets_maintenance','Tài sản đang bảo trì',count(*)::bigint,'available',now()
 from public.assets where status='maintenance';
end
$function$;

commit;