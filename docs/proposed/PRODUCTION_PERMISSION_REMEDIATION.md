# Đề xuất khắc phục phân quyền production — CHƯA ÁP DỤNG

Ngày đối chiếu: 2026-11-25  
Supabase project: akckcnijujtevfbginja

> Đây là bản SQL dự thảo để review. Chưa chạy trên Supabase production. Chỉ áp dụng sau khi có phê duyệt riêng, backup/rollback plan và kiểm tra tài khoản Admin còn hoạt động.

## 1. Hiện trạng đã xác minh

| Role | Quyền hiện tại |
|---|---|
| system_admin | 7 actions trên module system |
| ban_giam_hieu | view trên hr, reports, students |

Bảng role_permissions có khóa chính (role_id, module_id, action); data_scope không nằm trong khóa. Do đó thao tác grant phải dùng ON CONFLICT (role_id,module_id,action) DO UPDATE, không insert thêm một dòng khác scope.

Danh mục module hiện có: system, org, hr, admin_docs, finance, assets, admissions, students, training, teaching, grades, tasks, reports, ai_office.

## 2. SQL dự thảo — chuẩn hóa ma trận vai trò

~~~sql
begin;

do $$
begin
  if not exists (select 1 from public.roles where code = 'system_admin') then
    raise exception 'Missing role system_admin';
  end if;
  if not exists (select 1 from public.roles where code = 'ban_giam_hieu') then
    raise exception 'Missing role ban_giam_hieu';
  end if;
  if not exists (select 1 from public.modules where code = 'reports') then
    raise exception 'Missing module reports';
  end if;
end $$;

-- Admin quản lý toàn bộ module và action.
insert into public.role_permissions (role_id, module_id, action, data_scope)
select r.id, m.id, a.action, 'all'
from public.roles r
cross join public.modules m
cross join (values
  ('view'), ('create'), ('update'), ('delete'),
  ('approve'), ('import'), ('export')
) as a(action)
where r.code = 'system_admin'
on conflict (role_id, module_id, action)
do update set data_scope = excluded.data_scope, updated_at = now();

-- BGH chỉ được xem báo cáo; xóa mọi quyền cũ khác.
delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id
  and r.code = 'ban_giam_hieu';

insert into public.role_permissions (role_id, module_id, action, data_scope)
select r.id, m.id, 'view', 'all'
from public.roles r
join public.modules m on m.code = 'reports'
where r.code = 'ban_giam_hieu';

commit;
~~~

## 3. SQL dự thảo — tách biệt người đề xuất/người duyệt theo role bị tác động

Hàm hiện tại đã chặn người đề xuất tự quyết định và chặn Admin tự thay đổi role assignment của chính mình. Tuy nhiên, nó chưa chặn Admin đang giữ role A phê duyệt yêu cầu grant/revoke ma trận quyền của chính role A.

Bản thay thế dưới đây bổ sung kiểm tra đó. Chữ ký giữ nguyên để tương thích RPC hiện tại.

~~~sql
create or replace function public.decide_permission_change(
  p_id uuid,
  p_approve boolean,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r public.permission_change_requests;
  v_uid uuid := (select auth.uid());
  v_target_role text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not private.has_permission('system','approve') then
    raise exception 'not allowed to approve changes';
  end if;

  select * into r
  from public.permission_change_requests
  where id = p_id
  for update;

  if not found then raise exception 'request not found'; end if;
  if r.status <> 'pending' then raise exception 'request is not pending'; end if;
  if r.requested_by = v_uid then
    raise exception 'requester cannot decide own request';
  end if;

  if p_approve then
    if r.change_type in ('role_assign','role_unassign') then
      if (r.payload->>'user_id')::uuid = v_uid then
        raise exception 'approver cannot change own roles';
      end if;
    elsif r.change_type in ('matrix_grant','matrix_revoke') then
      v_target_role := r.payload->>'role_code';
      if exists (
        select 1
        from public.user_roles ur
        join public.roles ro on ro.id = ur.role_id
        where ur.user_id = v_uid
          and ro.code = v_target_role
      ) then
        raise exception 'approver cannot approve permission changes to a role they hold';
      end if;
    end if;

    perform private.apply_permission_change(r.change_type, r.payload);
    update public.permission_change_requests
    set status = 'applied', decided_by = v_uid,
        decided_at = now(), decision_note = p_note
    where id = p_id;
    return 'applied';
  else
    update public.permission_change_requests
    set status = 'rejected', decided_by = v_uid,
        decided_at = now(), decision_note = p_note
    where id = p_id;
    return 'rejected';
  end if;
end
$function$;
~~~

## 4. Trước khi áp dụng

- Kiểm tra toàn bộ RLS policies, grants và các RPC liên quan đến từng module; việc sửa role_permissions không tự động chứng minh mọi bảng nghiệp vụ đã có RLS đúng.
- Kiểm tra tài khoản Admin thứ hai độc lập để tránh khóa mất khả năng quản trị/phê duyệt.
- Kiểm thử: BGH chỉ đọc báo cáo; BGH không đọc được HR/students qua API; BGH không ghi dữ liệu; Admin thao tác được theo ma trận; người duyệt không tự phê duyệt hoặc thay đổi quyền của role mình đang giữ.
- Chạy trong transaction có xác minh hậu điều kiện và chuẩn bị rollback.
- Không dùng SQL này để cấp quyền cho tài khoản cá nhân hoặc tạo tài khoản.

## 5. Điểm cần xử lý thêm

Hàm private.apply_permission_change hiện dùng NOT EXISTS trước INSERT cho matrix_grant; vì PK là (role_id,module_id,action), nếu action đã tồn tại với scope khác thì có thể gặp duplicate key. Cần đổi sang upsert có chủ đích và kiểm tra payload trước khi áp dụng.
