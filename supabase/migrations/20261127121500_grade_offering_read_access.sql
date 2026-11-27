begin;
drop policy if exists class_subject_offerings_select on public.class_subject_offerings;
create policy class_subject_offerings_select on public.class_subject_offerings
for select to authenticated
using (
 private.has_permission('training','view',org_unit_id)
 or private.has_permission('teaching','view',org_unit_id)
 or private.has_permission('grades','view',org_unit_id)
);
commit;
