begin;
create or replace function public.add_work_update(p_work_item_id uuid,p_progress smallint,p_text text,p_blocker text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_item public.work_items; v_id uuid;
begin
 if v_uid is null then raise exception 'not authenticated'; end if;
 if p_progress<0 or p_progress>100 then raise exception 'progress must be between 0 and 100'; end if;
 if length(btrim(coalesce(p_text,'')))=0 then raise exception 'progress update text is required'; end if;
 select * into v_item from public.work_items where id=p_work_item_id for update;
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
 if coalesce(btrim(p_blocker),'')<>'' then
  update public.work_items set status='blocked',updated_at=now() where id=p_work_item_id;
 elsif v_item.status='blocked' then
  update public.work_items set status='in_progress',updated_at=now() where id=p_work_item_id;
 end if;
 insert into public.work_events(work_item_id,event_type,from_status,to_status,note,actor_id)
 values(p_work_item_id,'progress_update',v_item.status,
  case when coalesce(btrim(p_blocker),'')<>'' then 'blocked' else 'in_progress' end,
  left(btrim(p_text),1000),v_uid);
 return v_id;
end;
$function$;
revoke all on function public.add_work_update(uuid,smallint,text,text) from public,anon;
grant execute on function public.add_work_update(uuid,smallint,text,text) to authenticated;
commit;