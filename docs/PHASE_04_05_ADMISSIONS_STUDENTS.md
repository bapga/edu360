# EDU360 — Thiết kế chi tiết Chặng 4–5: Tuyển sinh và Người học

Trạng thái: **Thiết kế nghiệp vụ và dữ liệu; chưa tạo migration, chưa thay đổi Supabase**  
Ngày rà soát: 2026-11-26  
Nhánh triển khai: `feature/edu360-permission-hardening`

## 1. Phạm vi và nguyên tắc

Chặng 4 quản lý vòng đời tuyển sinh từ đợt tuyển sinh đến hồ sơ thí sinh, xét tuyển, xác nhận nhập học và bàn giao sang hồ sơ người học. Chặng 5 quản lý hồ sơ người học, lần nhập học, khóa/lớp, biến động lớp và người liên hệ.

- Tuyển sinh và người học dùng chung một cơ sở dữ liệu; không nhập lại hồ sơ cá nhân khi thí sinh nhập học.
- Một thí sinh có thể nộp nhiều hồ sơ ở các đợt khác nhau; mỗi hồ sơ thuộc đúng một đợt.
- Chỉ hồ sơ đã có quyết định trúng tuyển và xác nhận nhập học mới được chuyển thành người học.
- Chuyển đổi phải chạy trong một transaction/RPC có khóa chống chạy đồng thời; gọi lại cùng hồ sơ không tạo người học trùng.
- Hồ sơ người học là bản ghi gốc; lớp, khóa, biến động và giấy tờ là các bảng quan hệ/lịch sử.
- Không hard-delete hồ sơ đã phát sinh nghiệp vụ; dùng trạng thái, lý do và lịch sử.
- Mã hồ sơ, mã người học, mã lớp có unique constraint theo phạm vi năm/đợt phù hợp; không dựa vào kiểm tra trùng ở frontend.
- BGH chỉ nhận số liệu tổng hợp qua `reports.view`; không đọc bảng thí sinh hoặc người học trực tiếp.
- RLS/RPC là lớp quyết định quyền. Menu và route guard chỉ là trải nghiệm giao diện.

## 2. Baseline production đã kiểm tra

Tại project `akckcnijujtevfbginja`, schema `public` hiện có 13 bảng quản trị nền tảng; chưa có bảng tuyển sinh, người học, khóa hoặc lớp. Bảng `profiles` đang liên kết `staff_id`, chưa có liên kết người học. `org_units` có `id uuid`, `code`, `name`, `unit_type`, `parent_id`, `is_active`.

Các module quyền đã tồn tại trong `public.modules`: `admissions`, `students`, `reports`. Helper RLS đang được sử dụng theo các dạng:
- `private.has_permission(module_code, action)`
- `private.has_permission(module_code, action, org_unit_id)`

Không được coi việc module đã có trong bảng quyền là bằng chứng bảng nghiệp vụ hoặc RLS nghiệp vụ đã tồn tại.

## 3. Mô hình dữ liệu đề xuất

### 3.1. Tuyển sinh

| Bảng | Trách nhiệm | Khóa/kiểm soát chính |
|---|---|---|
| `admission_campaigns` | Đợt tuyển sinh, năm, thời gian nhận hồ sơ, trạng thái, chỉ tiêu | Mã đợt unique; ngày kết thúc không trước ngày bắt đầu |
| `applicants` | Hồ sơ thí sinh theo từng đợt | FK campaign; mã hồ sơ unique trong đợt; trạng thái |
| `applicant_documents` | Metadata giấy tờ, đường dẫn Storage, trạng thái xác minh | FK applicant; object path không public; loại giấy tờ |
| `admission_decisions` | Kết quả xét tuyển và quyết định | FK applicant; trạng thái/điểm/lý do; người và thời điểm quyết định |
| `admission_status_events` | Lịch sử chuyển trạng thái hồ sơ | Append-only; trạng thái trước/sau, người thực hiện, lý do |
| `applicant_enrollments` | Liên kết hồ sơ trúng tuyển với lần nhập học | Unique applicant; FK student_enrollments; thời điểm xác nhận |

Thông tin cá nhân được giữ tại `applicants` trước nhập học. Khi nhập học thành công, dữ liệu gốc được chuyển sang `students` qua RPC; bản ghi applicant giữ lại để truy vết tuyển sinh, không tiếp tục là nguồn hồ sơ cá nhân đang hoạt động.

Trạng thái đề xuất của hồ sơ: `draft`, `submitted`, `under_review`, `needs_update`, `eligible`, `admitted`, `waitlisted`, `rejected`, `enrolled`, `withdrawn`. Chỉ RPC chuyển trạng thái được phép thực hiện chuyển trạng thái; kiểm tra chuyển trạng thái hợp lệ tại database.

### 3.2. Người học

| Bảng | Trách nhiệm | Khóa/kiểm soát chính |
|---|---|---|
| `students` | Hồ sơ người học gốc | Mã người học unique; định danh cá nhân; trạng thái |
| `student_enrollments` | Mỗi lần nhập học vào một chương trình/khóa | FK student; mã nhập học; ngày nhập học; trạng thái |
| `cohorts` | Khóa tuyển sinh/niên khóa | Mã khóa unique; năm bắt đầu/kết thúc |
| `class_groups` | Lớp hành chính thuộc khóa | FK cohort; mã lớp unique theo niên khóa; trạng thái |
| `student_class_history` | Lịch sử xếp lớp, chuyển lớp, bảo lưu, thôi học | FK enrollment/class; hiệu lực từ/đến; lý do |
| `student_guardians` | Người liên hệ/giám hộ | FK student; quan hệ; thông tin liên hệ; cờ liên hệ chính |
| `student_documents` | Hồ sơ học tập/giấy tờ của người học | FK student hoặc enrollment; Storage object path riêng tư |
| `student_user_links` | Liên kết tài khoản đăng nhập với người học | FK auth.users và students; unique active link; chỉ quản trị qua RPC |

Các bảng chương trình đào tạo, nghề, môn/mô-đun được triển khai ở Chặng 6. Vì vậy, Chặng 4–5 không tự tạo bản sao danh mục nghề/chương trình; trường liên kết chương trình sẽ được bổ sung bằng FK trong migration Chặng 6 sau khi danh mục chuẩn được thiết kế.

### 3.3. Quy tắc chuyển đổi nhập học

RPC dự kiến: `public.confirm_applicant_enrollment(p_applicant_id uuid, p_cohort_id uuid, p_class_group_id uuid, p_enrollment_date date)`.

Trong transaction:
1. Kiểm tra `auth.uid()`, tài khoản active và `admissions.approve` trên đơn vị được giao.
2. Khóa hồ sơ applicant bằng `SELECT ... FOR UPDATE`.
3. Kiểm tra applicant đang ở trạng thái `admitted`, chưa có liên kết nhập học, có đủ thông tin bắt buộc.
4. Kiểm tra cohort/class_group đang hoạt động và class_group thuộc cohort được chọn.
5. Tạo `students` và `student_enrollments`; ghi `applicant_enrollments`; chuyển applicant sang `enrolled`; ghi status event và audit.
6. Trả về ID người học và lần nhập học.
7. Nếu RPC được gọi lại, trả kết quả đã tạo hoặc lỗi nghiệp vụ rõ ràng; tuyệt đối không tạo bản ghi thứ hai.

Không dùng frontend thực hiện nhiều lệnh INSERT độc lập cho quy trình này.

## 4. Phạm vi quyền đề xuất

| Vai trò/nghiệp vụ | Tuyển sinh | Người học |
|---|---|---|
| Admin | Toàn quyền theo ma trận đã duyệt | Toàn quyền theo ma trận đã duyệt |
| Phòng Đào tạo / cán bộ tuyển sinh | Xem/tạo/sửa hồ sơ theo phạm vi; người có approve mới xét duyệt | Xem/cập nhật theo nhiệm vụ |
| Phòng Quản lý HSSV | Theo quyền được cấp | Quản lý hồ sơ và biến động theo phạm vi |
| Khoa | Chỉ xem/xác nhận hồ sơ được giao nếu có quyền | Xem người học/lớp thuộc đơn vị |
| Giáo viên | Không mặc định có quyền tuyển sinh | Chỉ xem lớp được phân công nếu được cấp |
| Người học | Không truy cập hồ sơ tuyển sinh nội bộ | Chỉ xem hồ sơ của chính mình qua liên kết tài khoản và RPC/RLS |
| BGH | Không | Không; chỉ xem báo cáo tổng hợp |

Không tự cấp quyền cho bất kỳ role nào trong database. Ma trận cụ thể cần được Admin phê duyệt; mặc định deny.

## 5. RLS, Storage và bảo vệ dữ liệu

- Bật RLS cho mọi bảng nghiệp vụ mới trong schema exposed.
- Mọi policy phải ghi rõ `TO authenticated` và kiểm tra quyền module/action cùng phạm vi đơn vị.
- `applicants`, `students`, `student_guardians`, bảng tài liệu không được có policy SELECT rộng cho mọi tài khoản active.
- Không cho client trực tiếp INSERT/UPDATE trạng thái quyết định hoặc liên kết nhập học; các thao tác chuyển trạng thái và chuyển đổi dùng RPC kiểm tra quyền.
- Bảng lịch sử trạng thái và lịch sử lớp là append-only đối với người dùng thông thường.
- `student_user_links` không cho người dùng tự tạo hoặc tự đổi liên kết; chỉ RPC quản trị có kiểm tra quyền.
- File giấy tờ nằm trong private Storage bucket; policy Storage phải xác minh quyền đối với bản ghi cha; dùng signed URL thời hạn ngắn.
- Không đưa số định danh cá nhân, ngày sinh đầy đủ, địa chỉ, số điện thoại hoặc nội dung giấy tờ vào log ứng dụng.
- Báo cáo BGH chỉ trả count/tỷ lệ theo nhóm; chống suy ngược danh tính qua bộ lọc quá hẹp hoặc nhóm có số lượng quá nhỏ.
- Index các FK, trường trạng thái, campaign_id, cohort_id, class_group_id và các cột lọc thường dùng; đánh giá bằng EXPLAIN sau khi có dữ liệu.

## 6. Giao diện cần xây sau khi migration được duyệt

### Tuyển sinh
- Dashboard đợt tuyển sinh: số hồ sơ theo trạng thái, chỉ tiêu, tiến độ.
- Danh sách đợt: tìm kiếm, lọc năm/trạng thái, tạo/sửa theo quyền.
- Hồ sơ thí sinh: thông tin cá nhân, giấy tờ, lịch sử trạng thái, kết quả xét tuyển.
- Hàng đợi xét duyệt: chỉ người có admissions.approve mới thấy thao tác quyết định.
- Xác nhận nhập học: chọn khóa/lớp, preview thông tin, xác nhận một lần; chống double-submit.
- Import Excel: tải mẫu, preview mapping, validate lỗi/trùng, báo cáo dòng lỗi; không ghi ngay khi chưa xác nhận.
- Không tạo chức năng public self-registration trong giai đoạn này nếu chưa có yêu cầu và quy trình chống spam/xác minh.

### Người học
- Danh sách người học: tìm kiếm, lọc khóa/lớp/trạng thái, phân trang server-side.
- Hồ sơ người học dạng tab: thông tin chung, quá trình nhập học, lớp và biến động, người liên hệ, giấy tờ.
- Chuyển lớp/bảo lưu/thôi học: dialog có ngày hiệu lực và lý do; ghi lịch sử, không ghi đè mất lịch sử.
- Liên kết tài khoản: chỉ Admin thao tác; không tự gửi email mời hoặc tự tạo tài khoản trong module này.
- Xuất dữ liệu: chỉ người có students.export; log lần xuất và phạm vi; mặc định không xuất dữ liệu nhạy cảm.

## 7. Kiểm thử chấp nhận bắt buộc

1. Unique/constraint: trùng mã hồ sơ trong một đợt, trùng mã người học, class code trùng trong cùng niên khóa, FK sai.
2. Workflow: không thể xét duyệt hồ sơ chưa nộp; không thể nhập học khi chưa admitted; không thể nhập học hai lần.
3. Concurrency: hai request confirm cùng applicant chỉ tạo đúng một student và một enrollment.
4. Scope: chuyên viên đơn vị A không đọc/sửa dữ liệu đơn vị B; scope all chỉ hoạt động khi được cấp rõ.
5. BGH: SELECT trực tiếp mọi bảng tuyển sinh/người học trả 0 row hoặc permission denied; chỉ reports RPC hoạt động.
6. Người học: tài khoản A không thể đọc hồ sơ của B, kể cả đoán UUID hoặc gọi REST trực tiếp.
7. Storage: không truy cập được object của người học khác; signed URL hết hạn không dùng lại được.
8. Audit: lưu actor, action, record, thời điểm và lý do; không log dữ liệu cá nhân/giấy tờ.
9. Frontend: loading/empty/error, validation tiếng Việt, keyboard/focus, responsive; route/action đều kiểm tra quyền.
10. CI: typecheck, unit/integration tests, production build; preview test trước khi đề nghị merge.

## 8. Cổng triển khai

Chưa viết frontend CRUD cho hai chặng này vì schema production chưa có. Trước khi lập trình cần:
- Chốt từ điển dữ liệu và mẫu hồ sơ tuyển sinh thực tế của trường.
- Xác định các trường bắt buộc theo biểu mẫu/qui định hiện hành, không tự suy đoán.
- Chốt quyền theo vai trò và đơn vị; kiểm tra danh sách module/action thực tế.
- Soạn migration có constraints, indexes, RLS, grants, RPC và rollback.
- Review SQL, test trên môi trường an toàn và có phê duyệt rõ ràng trước khi áp dụng production.
