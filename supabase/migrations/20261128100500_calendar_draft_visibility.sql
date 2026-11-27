-- Keep unpublished calendar drafts visible only to their creator and authorized approvers.
drop policy if exists calendar_events_select on public.calendar_events;
create policy calendar_events_select
  on public.calendar_events for select to authenticated
  using (
    private.has_permission('tasks', 'view', org_unit_id)
    and (
      status <> 'draft'
      or created_by = (select auth.uid())
      or private.has_permission('tasks', 'approve', org_unit_id)
    )
  );