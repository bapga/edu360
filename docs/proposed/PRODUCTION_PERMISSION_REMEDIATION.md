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

-- Admin quản lý toàn bộ module nghiệp vụ và action đã được phê duyệt; AI Office không được cấp mặc định.
insert into public.role_permissions (role_id, module_id, action, data_scope)
select r.id, m.id, a.action, 'all'
from public.roles r
cross join public.modules m
cross join (values
  ('view'), ('create'), ('update'), ('delete'),
  ('approve'), ('import'), ('export')
) as a(action)
where r.code = 'system_admin'
  -- AI Office remains disabled until separate provider, privacy and budget approval.
  and m.code <> 'ai_office'
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


## 5. RLS metadata — BGH hiện còn đọc được dữ liệu cấu hình

Kiểm tra toàn bộ pg_policies cho thấy một số bảng hiện cho phép mọi tài khoản active đọc:
- modules_select: private.is_active_user().
- roles_select: private.is_active_user().
- role_permissions_select: private.is_active_user().
- org_units_select: private.is_active_user().

Như vậy, dù BGH bị chặn menu, họ vẫn có thể gọi Supabase API trực tiếp để đọc danh mục phân hệ, vai trò, ma trận quyền và danh sách cơ cấu tổ chức. Điều này chưa đáp ứng yêu cầu “BGH chỉ xem báo cáo”.

SQL dự thảo để siết các bảng cấu hình và danh mục tổ chức:

~~~sql
begin;

drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
for select to authenticated
using (private.has_permission('system','view'));

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
for select to authenticated
using (private.has_permission('system','view'));

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
for select to authenticated
using (private.has_permission('system','view'));

drop policy if exists org_units_select on public.org_units;
create policy org_units_select on public.org_units
for select to authenticated
using (
  private.has_permission('system','view')
  or private.has_permission('org','view', id)
  or private.has_permission('hr','view', id)
  or private.has_permission('admissions','view', id)
  or private.has_permission('students','view', id)
  or private.has_permission('training','view', id)
  or private.has_permission('teaching','view', id)
);

commit;
~~~

Lưu ý:
- Đây là dự thảo, chưa áp dụng.
- my_permissions() là SECURITY DEFINER và vẫn có thể trả về quyền của chính người đăng nhập; PermissionContext nên dùng kết quả đó để nhận diện role thay vì yêu cầu BGH đọc trực tiếp roles/role_permissions.
- user_roles hiện có policy cho phép người dùng đọc assignment của chính mình; cần đánh giá có giữ lại cho self-service hay chuyển sang RPC tối thiểu.
- Các báo cáo BGH cần được cung cấp qua RPC/view tổng hợp có kiểm tra reports.view; không mở SELECT trực tiếp các bảng nhân sự/người học chỉ để dựng biểu đồ.
- Trước khi áp dụng phải kiểm thử các phân hệ cần tên đơn vị (HR, tuyển sinh, người học, đào tạo, giảng dạy) để tránh vô tình chặn dữ liệu tham chiếu.


## 7. Kiểm kê SECURITY DEFINER RPC

Đã kiểm tra các SECURITY DEFINER functions có EXECUTE cho role authenticated. Các hàm nghiệp vụ chính đã có guard tương ứng:
- admin_link_staff/admin_unlink_staff: yêu cầu system.update và chặn tự sửa liên kết tài khoản của chính mình.
- admin_list_linkable_staff: yêu cầu system.view.
- request_permission_change: yêu cầu system.update, loại thay đổi nằm trong allowlist, lý do tối thiểu 10 ký tự và chặn tự đề xuất thay đổi role assignment của chính mình.
- decide_permission_change: yêu cầu system.approve, chỉ xử lý pending, chặn requester tự quyết định và chặn tự thay đổi role assignment.
- log_auth_event: chỉ ghi login/logout cho auth.uid() hiện tại.
- update_my_profile: chỉ cập nhật hồ sơ của auth.uid(), kiểm tra tên và avatar URL.
- my_permissions: chỉ trả quyền của auth.uid() và profile active.
- private.has_permission/private.is_active_user: helper RLS; không trả dữ liệu hồ sơ.

Các hàm trên đều đặt search_path rỗng. Đã xác minh anon không có EXECUTE trên các hàm SECURITY DEFINER thuộc public/private được kiểm tra; tuy vậy, cần giữ regression tests cho EXECUTE grants và guard logic khi thay đổi migration.

## 6. Điểm cần xử lý thêm

Hàm `private.apply_permission_change` hiện dùng `NOT EXISTS` trước `INSERT` cho `matrix_grant`. Cách này không xử lý trường hợp action đã tồn tại với scope khác; do PK là `(role_id,module_id,action)`, thao tác có thể gặp duplicate key. Kiểm tra trực tiếp định nghĩa production ngày 2026-11-26 xác nhận đúng hành vi này.

Bản thay thế dự thảo dưới đây dùng `ON CONFLICT` để cập nhật scope một cách nguyên tử. Chỉ áp dụng đồng thời với kiểm thử RPC quyết định, RLS, audit và quyền EXECUTE. Chưa chạy trên production.

~~~sql
create or replace function private.apply_permission_change(
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role uuid;
  v_module uuid;
  v_user uuid;
  v_unit uuid;
  v_rows integer;
  v_action text;
  v_scope text;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid permission change payload';
  end if;

  if p_type in ('matrix_grant', 'matrix_revoke') then
    select id into v_role
    from public.roles
    where code = p_payload->>'role_code';

    select id into v_module
    from public.modules
    where code = p_payload->>'module_code';

    v_action := p_payload->>'action';
    v_scope := p_payload->>'data_scope';

    if v_role is null then raise exception 'unknown role code'; end if;
    if v_module is null then raise exception 'unknown module code'; end if;
    if v_action is null or v_action not in ('view','create','update','delete','approve','import','export') then
      raise exception 'invalid action';
    end if;
    if v_scope is null or v_scope not in ('all','unit','own') then raise exception 'invalid data scope'; end if;

    if p_type = 'matrix_grant' then
      insert into public.role_permissions (role_id, module_id, action, data_scope)
      values (v_role, v_module, v_action, v_scope)
      on conflict (role_id, module_id, action)
      do update set data_scope = excluded.data_scope, updated_at = now();
    else
      delete from public.role_permissions
      where role_id = v_role
        and module_id = v_module
        and action = v_action
        and data_scope = v_scope;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then raise exception 'permission not found'; end if;
    end if;

  elsif p_type in ('role_assign', 'role_unassign') then
    select id into v_role
    from public.roles
    where code = p_payload->>'role_code';

    if v_role is null then raise exception 'unknown role code'; end if;
    v_user := nullif(p_payload->>'user_id','')::uuid;
    v_unit := nullif(p_payload->>'org_unit_id','')::uuid;
    if v_user is null then raise exception 'missing user id'; end if;

    if not exists (select 1 from public.profiles where id = v_user) then
      raise exception 'unknown user';
    end if;

    if p_type = 'role_assign' then
      -- user_roles has only a surrogate PK(id), no unique constraint on the natural key.
      -- Serialize identical assignments before checking/inserting.
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          v_user::text || ':' || v_role::text || ':' || coalesce(v_unit::text, '<null>'),
          0
        )
      );
      insert into public.user_roles (user_id, role_id, org_unit_id)
      select v_user, v_role, v_unit
      where not exists (
        select 1 from public.user_roles ur
        where ur.user_id = v_user
          and ur.role_id = v_role
          and ur.org_unit_id is not distinct from v_unit
      );
    else
      delete from public.user_roles
      where user_id = v_user
        and role_id = v_role
        and org_unit_id is not distinct from v_unit;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then raise exception 'assignment not found'; end if;
    end if;
  else
    raise exception 'unknown change type';
  end if;
end
$function$;
~~~

**Đã đối chiếu schema production:** `user_roles` chỉ có primary key `id`, không có unique constraint trên `(user_id, role_id, org_unit_id)`. Vì vậy bản dự thảo dùng transaction advisory lock theo bộ khóa tự nhiên rồi mới kiểm tra/tạo assignment; không sử dụng `ON CONFLICT` trên constraint không tồn tại. Vẫn cần kiểm thử race condition và đánh giá các luồng ghi khác trước khi áp dụng.