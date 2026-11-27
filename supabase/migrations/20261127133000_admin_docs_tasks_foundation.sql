begin;

create table public.admin_documents (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 document_no text not null,
 document_type text not null check(document_type in ('incoming','outgoing','internal')),
 subject text not null,
 sender text,
 recipient text,
 issued_date date,
 received_date date,
 effective_date date,
 confidentiality text not null default 'internal' check(confidentiality in ('public','internal','confidential')),
 summary text,
 file_reference text,
 status text not null default 'draft' check(status in ('draft','submitted','approved','returned','issued','archived')),
 created_by uuid not null default auth.uid() references auth.users(id),
 submitted_by uuid references auth.users(id),
 submitted_at timestamptz,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 issued_by uuid references auth.users(id),
 issued_at timestamptz,
 archived_by uuid references auth.users(id),
 archived_at timestamptz,
 decision_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(org_unit_id,document_no)
);

create table public.document_events (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.admin_documents(id),
 event_type text not null,
 from_status text,
 to_status text,
 note text,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);

create table public.work_items (
 id uuid primary key default gen_random_uuid(),
 org_unit_id uuid not null references public.org_units(id),
 task_no text not null,
 title text not null,
 description text,
 category text,
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 status text not null default 'draft' check(status in ('draft','submitted','approved','returned','in_progress','blocked','completion_requested','completed','cancelled')),
 start_date date,
 due_date date,
 created_by uuid not null default auth.uid() references auth.users(id),
 submitted_by uuid references auth.users(id),
 submitted_at timestamptz,
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 completion_requested_by uuid references auth.users(id),
 completion_requested_at timestamptz,
 completed_by uuid references auth.users(id),
 completed_at timestamptz,
 decision_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(org_unit_id,task_no),
 check(due_date is null or start_date is null or due_date>=start_date)
);

create table public.work_assignments (
 id uuid primary key default gen_random_uuid(),
 work_item_id uuid not null references public.work_items(id),
 staff_id uuid not null references public.staff(id),
 assignment_role text not null default 'owner' check(assignment_role in ('owner','contributor','reviewer')),
 status text not null default 'active' check(status in ('active','completed','revoked')),
 assigned_by uuid not null references auth.users(id),
 assigned_at timestamptz not null default now(),
 unique(work_item_id,staff_id,assignment_role)
);

create table public.work_updates (
 id uuid primary key default gen_random_uuid(),
 work_item_id uuid not null references public.work_items(id),
 progress_percent smallint not null check(progress_percent between 0 and 100),
 update_text text not null,
 blocker text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);

create table public.work_events (
 id uuid primary key default gen_random_uuid(),
 work_item_id uuid not null references public.work_items(id),
 event_type text not null,
 from_status text,
 to_status text,
 note text,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);

create index admin_documents_unit_status_date_idx on public.admin_documents(org_unit_id,status,created_at desc);
create index document_events_document_idx on public.document_events(document_id,created_at desc);
create index work_items_unit_status_due_idx on public.work_items(org_unit_id,status,due_date);
create index work_assignments_staff_status_idx on public.work_assignments(staff_id,status);
create index work_updates_item_date_idx on public.work_updates(work_item_id,created_at desc);
create index work_events_item_date_idx on public.work_events(work_item_id,created_at desc);

alter table public.admin_documents enable row level security;
alter table public.document_events enable row level security;
alter table public.work_items enable row level security;
alter table public.work_assignments enable row level security;
alter table public.work_updates enable row level security;
alter table public.work_events enable row level security;

create policy admin_documents_select on public.admin_documents for select to authenticated
 using(private.has_permission('admin_docs','view',org_unit_id));
create policy admin_documents_insert on public.admin_documents for insert to authenticated
 with check(status='draft' and created_by=auth.uid() and private.has_permission('admin_docs','create',org_unit_id));
create policy admin_documents_update on public.admin_documents for update to authenticated
 using(status in ('draft','returned') and private.has_permission('admin_docs','update',org_unit_id))
 with check(status in ('draft','returned') and private.has_permission('admin_docs','update',org_unit_id));

create policy document_events_select on public.document_events for select to authenticated
 using(exists(select 1 from public.admin_documents d where d.id=document_id and private.has_permission('admin_docs','view',d.org_unit_id)));

create policy work_items_select on public.work_items for select to authenticated
 using(private.has_permission('tasks','view',org_unit_id));
create policy work_items_insert on public.work_items for insert to authenticated
 with check(status='draft' and created_by=auth.uid() and private.has_permission('tasks','create',org_unit_id));
create policy work_items_update on public.work_items for update to authenticated
 using(status in ('draft','returned') and private.has_permission('tasks','update',org_unit_id))
 with check(status in ('draft','returned') and private.has_permission('tasks','update',org_unit_id));

create policy work_assignments_select on public.work_assignments for select to authenticated
 using(exists(select 1 from public.work_items w where w.id=work_item_id and private.has_permission('tasks','view',w.org_unit_id)));
create policy work_updates_select on public.work_updates for select to authenticated
 using(exists(select 1 from public.work_items w where w.id=work_item_id and private.has_permission('tasks','view',w.org_unit_id)));
create policy work_updates_insert on public.work_updates for insert to authenticated
 with check(created_by=auth.uid() and exists(
  select 1 from public.work_items w where w.id=work_item_id
   and (private.has_permission('tasks','update',w.org_unit_id)
    or exists(select 1 from public.work_assignments a join public.staff s on s.id=a.staff_id
     where a.work_item_id=w.id and a.status='active' and s.user_id=auth.uid()))
 ));
create policy work_events_select on public.work_events for select to authenticated
 using(exists(select 1 from public.work_items w where w.id=work_item_id and private.has_permission('tasks','view',w.org_unit_id)));

create or replace function public.get_task_staff_lookup(p_org_unit_id uuid)
returns table(staff_id uuid,staff_code text,full_name text)
language plpgsql security definer set search_path=''
as $function$
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 if not private.has_permission('tasks','view',p_org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 return query
 select distinct s.id,s.staff_code,s.full_name
 from public.staff s join public.staff_assignments sa on sa.staff_id=s.id
 where s.status='active' and s.deleted_at is null and sa.org_unit_id=p_org_unit_id
  and sa.status='active' and (sa.end_date is null or sa.end_date>=current_date)
 order by s.full_name;
end;
$function$;

create or replace function public.submit_admin_document(p_document_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_doc public.admin_documents;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_doc from public.admin_documents where id=p_document_id for update;
 if not found then raise exception 'document not found'; end if;
 if not private.has_permission('admin_docs','update',v_doc.org_unit_id)
  and not (v_doc.created_by=v_uid and private.has_permission('admin_docs','create',v_doc.org_unit_id)) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_doc.status not in ('draft','returned') then raise exception 'document cannot be submitted'; end if;
 update public.admin_documents set status='submitted',submitted_by=v_uid,submitted_at=now(),updated_at=now() where id=p_document_id;
 insert into public.document_events(document_id,event_type,from_status,to_status,actor_id)
 values(p_document_id,'submit',v_doc.status,'submitted',v_uid);
end;
$function$;

create or replace function public.decide_admin_document(p_document_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_doc public.admin_documents;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_note,'')))<5 then raise exception 'decision note must contain at least 5 characters'; end if;
 select * into v_doc from public.admin_documents where id=p_document_id for update;
 if not found then raise exception 'document not found'; end if;
 if not private.has_permission('admin_docs','approve',v_doc.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_doc.status<>'submitted' then raise exception 'document is not awaiting approval'; end if;
 if v_doc.submitted_by=v_uid then raise exception 'submitter cannot approve own document'; end if;
 update public.admin_documents set status=case when p_approve then 'approved' else 'returned' end,
  approved_by=case when p_approve then v_uid else null end,approved_at=case when p_approve then now() else null end,
  decision_note=left(btrim(p_note),2000),updated_at=now() where id=p_document_id;
 insert into public.document_events(document_id,event_type,from_status,to_status,note,actor_id)
 values(p_document_id,case when p_approve then 'approve' else 'return' end,'submitted',
  case when p_approve then 'approved' else 'returned' end,left(btrim(p_note),2000),v_uid);
 insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
 values(v_uid,case when p_approve then 'approve_admin_document' else 'return_admin_document' end,
  'admin_documents',p_document_id::text,jsonb_build_object('note',left(btrim(p_note),2000)));
end;
$function$;

create or replace function public.issue_admin_document(p_document_id uuid,p_issue_reference text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_doc public.admin_documents;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_doc from public.admin_documents where id=p_document_id for update;
 if not found then raise exception 'document not found'; end if;
 if not private.has_permission('admin_docs','approve',v_doc.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_doc.status<>'approved' then raise exception 'only approved documents can be issued'; end if;
 update public.admin_documents set status='issued',issued_by=v_uid,issued_at=now(),
  file_reference=coalesce(nullif(btrim(p_issue_reference),''),file_reference),updated_at=now()
 where id=p_document_id;
 insert into public.document_events(document_id,event_type,from_status,to_status,note,actor_id)
 values(p_document_id,'issue','approved','issued',left(coalesce(p_issue_reference,''),1000),v_uid);
end;
$function$;

create or replace function public.archive_admin_document(p_document_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_doc public.admin_documents;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_reason,'')))<5 then raise exception 'archive reason must contain at least 5 characters'; end if;
 select * into v_doc from public.admin_documents where id=p_document_id for update;
 if not found then raise exception 'document not found'; end if;
 if not private.has_permission('admin_docs','approve',v_doc.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_doc.status<>'issued' then raise exception 'only issued documents can be archived'; end if;
 update public.admin_documents set status='archived',archived_by=v_uid,archived_at=now(),updated_at=now() where id=p_document_id;
 insert into public.document_events(document_id,event_type,from_status,to_status,note,actor_id)
 values(p_document_id,'archive','issued','archived',left(btrim(p_reason),2000),v_uid);
end;
$function$;

create or replace function public.assign_work_item(p_work_item_id uuid,p_staff_id uuid,p_role text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_item public.work_items; v_assignment uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_item from public.work_items where id=p_work_item_id for update;
 if not found then raise exception 'work item not found'; end if;
 if not private.has_permission('tasks','update',v_item.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_item.status not in ('draft','returned','approved','in_progress') then raise exception 'work item cannot be assigned in current status'; end if;
 if p_role not in ('owner','contributor','reviewer') then raise exception 'invalid assignment role'; end if;
 if not exists(select 1 from public.staff s join public.staff_assignments sa on sa.staff_id=s.id
  where s.id=p_staff_id and s.status='active' and s.deleted_at is null and sa.org_unit_id=v_item.org_unit_id
   and sa.status='active' and (sa.end_date is null or sa.end_date>=current_date)) then
  raise exception 'staff is not active in this organization unit';
 end if;
 insert into public.work_assignments(work_item_id,staff_id,assignment_role,status,assigned_by)
 values(p_work_item_id,p_staff_id,p_role,'active',v_uid)
 on conflict(work_item_id,staff_id,assignment_role) do update set status='active',assigned_by=v_uid,assigned_at=now()
 returning id into v_assignment;
 insert into public.work_events(work_item_id,event_type,note,actor_id)
 values(p_work_item_id,'assign',p_role,v_uid);
 return v_assignment;
end;
$function$;

create or replace function public.submit_work_item(p_work_item_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_item public.work_items;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_item from public.work_items where id=p_work_item_id for update;
 if not found then raise exception 'work item not found'; end if;
 if not private.has_permission('tasks','update',v_item.org_unit_id)
  and not (v_item.created_by=v_uid and private.has_permission('tasks','create',v_item.org_unit_id)) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_item.status not in ('draft','returned') then raise exception 'work item cannot be submitted'; end if;
 if not exists(select 1 from public.work_assignments a where a.work_item_id=p_work_item_id and a.assignment_role='owner' and a.status='active') then
  raise exception 'assign at least one owner before submission';
 end if;
 update public.work_items set status='submitted',submitted_by=v_uid,submitted_at=now(),updated_at=now() where id=p_work_item_id;
 insert into public.work_events(work_item_id,event_type,from_status,to_status,actor_id)
 values(p_work_item_id,'submit',v_item.status,'submitted',v_uid);
end;
$function$;

create or replace function public.decide_work_item(p_work_item_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_item public.work_items;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_note,'')))<5 then raise exception 'decision note must contain at least 5 characters'; end if;
 select * into v_item from public.work_items where id=p_work_item_id for update;
 if not found then raise exception 'work item not found'; end if;
 if not private.has_permission('tasks','approve',v_item.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_item.status<>'submitted' then raise exception 'work item is not awaiting approval'; end if;
 if v_item.submitted_by=v_uid then raise exception 'submitter cannot approve own work item'; end if;
 update public.work_items set status=case when p_approve then 'approved' else 'returned' end,
  approved_by=case when p_approve then v_uid else null end,approved_at=case when p_approve then now() else null end,
  decision_note=left(btrim(p_note),2000),updated_at=now() where id=p_work_item_id;
 insert into public.work_events(work_item_id,event_type,from_status,to_status,note,actor_id)
 values(p_work_item_id,case when p_approve then 'approve' else 'return' end,'submitted',
  case when p_approve then 'approved' else 'returned' end,left(btrim(p_note),2000),v_uid);
end;
$function$;

create or replace function public.start_work_item(p_work_item_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_item public.work_items;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_item from public.work_items where id=p_work_item_id for update;
 if not found then raise exception 'work item not found'; end if;
 if not private.has_permission('tasks','update',v_item.org_unit_id)
  and not exists(select 1 from public.work_assignments a join public.staff s on s.id=a.staff_id
   where a.work_item_id=p_work_item_id and a.status='active' and s.user_id=v_uid) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_item.status<>'approved' then raise exception 'only approved tasks can start'; end if;
 update public.work_items set status='in_progress',updated_at=now() where id=p_work_item_id;
 insert into public.work_events(work_item_id,event_type,from_status,to_status,actor_id)
 values(p_work_item_id,'start','approved','in_progress',v_uid);
end;
$function$;

create or replace function public.request_work_completion(p_work_item_id uuid,p_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_item public.work_items;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_item from public.work_items where id=p_work_item_id for update;
 if not found then raise exception 'work item not found'; end if;
 if not private.has_permission('tasks','update',v_item.org_unit_id)
  and not exists(select 1 from public.work_assignments a join public.staff s on s.id=a.staff_id
   where a.work_item_id=p_work_item_id and a.status='active' and s.user_id=v_uid) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 if v_item.status not in ('in_progress','blocked') then raise exception 'work item is not ready for completion request'; end if;
 update public.work_items set status='completion_requested',completion_requested_by=v_uid,
  completion_requested_at=now(),decision_note=left(coalesce(p_note,''),2000),updated_at=now() where id=p_work_item_id;
 insert into public.work_events(work_item_id,event_type,from_status,to_status,note,actor_id)
 values(p_work_item_id,'request_completion',v_item.status,'completion_requested',left(coalesce(p_note,''),2000),v_uid);
end;
$function$;

create or replace function public.decide_work_completion(p_work_item_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_item public.work_items;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if length(btrim(coalesce(p_note,'')))<5 then raise exception 'decision note must contain at least 5 characters'; end if;
 select * into v_item from public.work_items where id=p_work_item_id for update;
 if not found then raise exception 'work item not found'; end if;
 if not private.has_permission('tasks','approve',v_item.org_unit_id) then raise exception 'not allowed' using errcode='42501'; end if;
 if v_item.status<>'completion_requested' then raise exception 'work item is not awaiting completion approval'; end if;
 if v_item.completion_requested_by=v_uid then raise exception 'requester cannot approve own completion'; end if;
 update public.work_items set status=case when p_approve then 'completed' else 'in_progress' end,
  completed_by=case when p_approve then v_uid else null end,completed_at=case when p_approve then now() else null end,
  decision_note=left(btrim(p_note),2000),updated_at=now() where id=p_work_item_id;
 insert into public.work_events(work_item_id,event_type,from_status,to_status,note,actor_id)
 values(p_work_item_id,case when p_approve then 'complete' else 'return_completion' end,'completion_requested',
  case when p_approve then 'completed' else 'in_progress' end,left(btrim(p_note),2000),v_uid);
end;
$function$;

create or replace function public.add_work_update(p_work_item_id uuid,p_progress smallint,p_text text,p_blocker text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_item public.work_items; v_id uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 select * into v_item from public.work_items where id=p_work_item_id;
 if not found then raise exception 'work item not found'; end if;
 if v_item.status not in ('in_progress','blocked') then raise exception 'work item is not in progress'; end if;
 if not private.has_permission('tasks','update',v_item.org_unit_id)
  and not exists(select 1 from public.work_assignments a join public.staff s on s.id=a.staff_id
   where a.work_item_id=p_work_item_id and a.status='active' and s.user_id=v_uid) then
  raise exception 'not allowed' using errcode='42501';
 end if;
 insert into public.work_updates(work_item_id,progress_percent,update_text,blocker,created_by)
 values(p_work_item_id,p_progress,left(btrim(p_text),4000),nullif(left(btrim(coalesce(p_blocker,'')),2000),''),v_uid)
 returning id into v_id;
 if p_progress<100 and v_item.status='blocked' and coalesce(p_blocker,'')='' then
  update public.work_items set status='in_progress',updated_at=now() where id=p_work_item_id;
 end if;
 return v_id;
end;
$function$;

revoke all on function public.get_task_staff_lookup(uuid) from public,anon;
revoke all on function public.submit_admin_document(uuid) from public,anon;
revoke all on function public.decide_admin_document(uuid,boolean,text) from public,anon;
revoke all on function public.issue_admin_document(uuid,text) from public,anon;
revoke all on function public.archive_admin_document(uuid,text) from public,anon;
revoke all on function public.assign_work_item(uuid,uuid,text) from public,anon;
revoke all on function public.submit_work_item(uuid) from public,anon;
revoke all on function public.decide_work_item(uuid,boolean,text) from public,anon;
revoke all on function public.start_work_item(uuid) from public,anon;
revoke all on function public.request_work_completion(uuid,text) from public,anon;
revoke all on function public.decide_work_completion(uuid,boolean,text) from public,anon;
revoke all on function public.add_work_update(uuid,smallint,text,text) from public,anon;
grant execute on function public.get_task_staff_lookup(uuid) to authenticated;
grant execute on function public.submit_admin_document(uuid) to authenticated;
grant execute on function public.decide_admin_document(uuid,boolean,text) to authenticated;
grant execute on function public.issue_admin_document(uuid,text) to authenticated;
grant execute on function public.archive_admin_document(uuid,text) to authenticated;
grant execute on function public.assign_work_item(uuid,uuid,text) to authenticated;
grant execute on function public.submit_work_item(uuid) to authenticated;
grant execute on function public.decide_work_item(uuid,boolean,text) to authenticated;
grant execute on function public.start_work_item(uuid) to authenticated;
grant execute on function public.request_work_completion(uuid,text) to authenticated;
grant execute on function public.decide_work_completion(uuid,boolean,text) to authenticated;
grant execute on function public.add_work_update(uuid,smallint,text,text) to authenticated;

grant select,insert,update on public.admin_documents,public.work_items to authenticated;
grant select on public.document_events,public.work_assignments,public.work_events to authenticated;
grant select,insert on public.work_updates to authenticated;

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
 union all select 'active_staff','Nhân sự đang công tác',count(*)::bigint,'available',now()
 from public.staff where status='active' and deleted_at is null
 union all select 'active_staff_assignments','Phân công công tác đang hiệu lực',count(*)::bigint,'available',now()
 from public.staff_assignments where status='active' and (end_date is null or end_date>=current_date)
 union all select 'active_students','Người học đang học',count(*)::bigint,'available',now()
 from public.students where status='active'
 union all select 'admissions','Hồ sơ tuyển sinh',count(*)::bigint,'available',now()
 from public.applicants where status not in ('withdrawn')
 union all select 'training_results','Kết quả đào tạo và điểm',null::bigint,'not_available',now()
 union all select 'issued_invoices','Hóa đơn đã phát hành',count(*)::bigint,'available',now()
 from public.student_invoices where status in ('issued','partially_paid','paid')
 union all select 'outstanding_receivables_vnd','Công nợ phải thu (đồng)',coalesce(sum(i.total_amount-coalesce(p.paid,0)),0)::bigint,'available',now()
 from public.student_invoices i left join (select invoice_id,sum(amount) paid from public.payment_receipts where status='confirmed' group by invoice_id) p on p.invoice_id=i.id
 where i.status in ('issued','partially_paid')
 union all select 'pending_expenses','Đề nghị chi chờ xử lý',count(*)::bigint,'available',now()
 from public.expense_requests where status in ('submitted','approved')
 union all select 'assets_total','Tổng số tài sản',count(*)::bigint,'available',now()
 from public.assets where status<>'disposed'
 union all select 'assets_assigned','Tài sản đang bàn giao',count(*)::bigint,'available',now()
 from public.assets where status='assigned'
 union all select 'assets_maintenance','Tài sản đang bảo trì',count(*)::bigint,'available',now()
 from public.assets where status='maintenance'
 union all select 'documents_pending','Văn bản chờ phê duyệt',count(*)::bigint,'available',now()
 from public.admin_documents where status='submitted'
 union all select 'tasks_open','Công việc đang thực hiện',count(*)::bigint,'available',now()
 from public.work_items where status in ('approved','in_progress','blocked','completion_requested')
 union all select 'tasks_overdue','Công việc quá hạn',count(*)::bigint,'available',now()
 from public.work_items where due_date<current_date and status not in ('completed','cancelled');
end
$function$;

commit;