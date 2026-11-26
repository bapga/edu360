# EDU360 — Đề xuất mô hình dữ liệu nghiệp vụ dùng chung

Trạng thái: **Đề xuất thiết kế, chưa tạo bảng hoặc áp dụng migration**  
Ngày: 2026-11-25

## 1. Nguyên tắc thiết kế

1. Một hồ sơ gốc cho mỗi người học và một hồ sơ gốc cho mỗi nhân sự; các phân hệ chỉ tham chiếu bằng khóa ngoại.
2. Tuyển sinh và người học liên thông: hồ sơ trúng tuyển được chuyển thành hồ sơ người học một lần, không nhập lại thông tin.
3. Chương trình đào tạo được quản lý theo phiên bản và niên khóa; không sửa hồi tố chương trình đã áp dụng cho khóa trước.
4. Môn học/mô-đun nghề dùng chung một danh mục học phần; tránh tạo bảng trùng tên với public.modules (bảng này đang dùng cho phân quyền phần mềm).
5. Điểm chỉ có một nguồn chuẩn; không sao chép điểm sang báo cáo hoặc hồ sơ người học.
6. Thời khóa biểu, phân công giảng dạy, chuyên cần và điểm phải cùng tham chiếu lớp, học phần và nhân sự.
7. BGH chỉ nhận dữ liệu tổng hợp qua reports RPC/view có kiểm tra reports.view; không SELECT trực tiếp bảng hồ sơ cá nhân.
8. Mọi bảng nghiệp vụ cần created_at, updated_at, created_by, updated_by, trạng thái phù hợp và audit trigger; soft-delete chỉ dùng khi có căn cứ nghiệp vụ.

## 2. Danh mục bảng đề xuất

### 2.1. Tuyển sinh

| Bảng | Vai trò |
|---|---|
| admission_campaigns | Đợt/năm tuyển sinh, chỉ tiêu, thời gian |
| applicants | Hồ sơ thí sinh; thông tin cá nhân gốc trước khi nhập học |
| applicant_documents | Hồ sơ/giấy tờ kèm theo, đường dẫn Storage và trạng thái xác minh |
| admission_decisions | Kết quả xét tuyển, người duyệt, thời điểm và lý do |
| applicant_enrollments | Liên kết thí sinh trúng tuyển với student_id sau khi nhập học |

Quy tắc: mã hồ sơ duy nhất trong đợt; không tạo student khi chưa xác nhận nhập học; chuyển đổi applicant → student phải có transaction/RPC chống tạo trùng.

### 2.2. Người học

| Bảng | Vai trò |
|---|---|
| students | Hồ sơ người học gốc duy nhất |
| student_enrollments | Lần nhập học/khóa học của người học, nghề, khóa, trạng thái |
| cohorts | Khóa tuyển sinh/niên khóa và thời gian đào tạo |
| class_groups | Lớp hành chính thuộc cohort/chương trình |
| student_class_history | Lịch sử chuyển lớp, bảo lưu, thôi học, chuyển trường |
| student_guardians | Người liên hệ/giám hộ, quan hệ và thông tin liên lạc |
| student_documents | Hồ sơ học tập, minh chứng và giấy tờ |

Tách students khỏi student_enrollments để một người không bị tạo hồ sơ trùng khi học liên thông hoặc có nhiều lần nhập học theo quy định.

### 2.3. Chương trình và giảng dạy

| Bảng | Vai trò |
|---|---|
| occupations | Danh mục nghề/mã nghề/trình độ |
| training_programs | Chương trình đào tạo theo nghề |
| program_versions | Phiên bản chương trình theo quyết định/niên khóa |
| subjects | Danh mục môn học/mô-đun, loại học phần |
| program_subjects | Học phần trong phiên bản chương trình, số giờ, học kỳ, thứ tự |
| teaching_assignments | Phân công giáo viên cho lớp và học phần |
| academic_terms | Năm học, học kỳ và khoảng thời gian |
| classrooms | Phòng học/xưởng thực hành và sức chứa |

Không đặt tên bảng danh mục học phần là modules vì public.modules đã là danh mục phân hệ phần mềm.

### 2.4. Thời khóa biểu và chuyên cần

| Bảng | Vai trò |
|---|---|
| timetable_templates | Mẫu thời khóa biểu tuần, thứ, tiết, buổi |
| timetable_sessions | Buổi học thực tế, ngày, tiết, phòng, giáo viên, học phần |
| attendance_sessions | Phiên điểm danh gắn với buổi học |
| attendance_records | Trạng thái có mặt/vắng/có phép/trễ của từng người học |

Quy tắc: không xếp trùng giáo viên, lớp hoặc phòng trong cùng khung thời gian; thay đổi lịch phải lưu người thay đổi và lý do.

### 2.5. Kiểm tra, đánh giá và điểm

| Bảng | Vai trò |
|---|---|
| assessment_items | Thành phần đánh giá, loại điểm, hệ số, thang điểm |
| grade_entries | Điểm một người học cho một thành phần đánh giá |
| grade_change_requests | Yêu cầu sửa điểm sau khi nộp/khóa |
| grade_lock_events | Nhật ký mở khóa/khóa điểm, người duyệt và lý do |
| academic_results | Kết quả tổng hợp theo học phần/học kỳ nếu cần lưu snapshot có version |

Quy tắc:
- Unique theo student_enrollment_id + assessment_item_id.
- Validate điểm theo thang điểm và max_score.
- Giáo viên chỉ nhập điểm lớp/học phần được phân công.
- Phòng Đào tạo kiểm tra, khóa/mở khóa theo quy trình.
- Không cho ghi đè điểm đã khóa; sửa điểm phải qua request và audit.
- Điểm tổng hợp phải tính từ grade_entries theo công thức phiên bản; nếu lưu snapshot phải có version và nguồn truy vết.

### 2.6. Xét tốt nghiệp

| Bảng | Vai trò |
|---|---|
| graduation_reviews | Đợt xét tốt nghiệp và trạng thái |
| graduation_review_items | Điều kiện/kết quả từng người học |
| graduation_decisions | Quyết định cuối cùng và số văn bản |

### 2.7. Hành chính - Văn bản

| Bảng | Vai trò |
|---|---|
| admin_documents | Hồ sơ văn bản đến/đi, số ký hiệu, ngày, trích yếu, đơn vị phát hành |
| document_types | Danh mục loại văn bản |
| document_routes | Luồng chuyển xử lý, người/đơn vị nhận, hạn xử lý, trạng thái |
| document_attachments | Tệp đính kèm trong Storage, metadata và phân loại |
| document_comments | Ý kiến xử lý, bút phê và lịch sử trao đổi |

Văn bản cần số đến/số đi duy nhất theo sổ và năm; file phải được kiểm soát bằng Storage policy, không lưu đường dẫn công khai.

### 2.8. Tài chính, tài sản và điều hành

| Bảng | Vai trò |
|---|---|
| budget_periods | Năm ngân sách/kỳ kế hoạch |
| budget_items | Dự toán theo nguồn, mục lục và đơn vị |
| finance_transactions | Khoản thu/chi đã được duyệt, tham chiếu chứng từ |
| finance_vouchers | Phiếu thu/chi và trạng thái duyệt |
| asset_categories | Danh mục nhóm tài sản |
| assets | Hồ sơ tài sản, mã tài sản, nguồn hình thành, giá trị, tình trạng |
| asset_assignments | Bàn giao tài sản cho đơn vị/người sử dụng |
| asset_maintenance | Lịch sử sửa chữa, bảo trì, kiểm kê |
| work_tasks | Công việc, người giao, hạn, mức ưu tiên, trạng thái |
| task_assignees | Người/đơn vị phối hợp và trách nhiệm |
| task_comments | Trao đổi và lịch sử cập nhật công việc |
| work_calendar_events | Lịch họp, lịch công tác, sự kiện của đơn vị |

Các bảng tài chính cần quy trình duyệt và khóa sổ; không cho sửa/xóa giao dịch đã ghi sổ. Tài sản cần lịch sử bàn giao/kiểm kê; không chỉ lưu người giữ hiện tại.

## 3. Quan hệ chính (ERD định hướng)

~~~mermaid
erDiagram
  ADMISSION_CAMPAIGNS ||--o{ APPLICANTS : receives
  APPLICANTS ||--o{ APPLICANT_DOCUMENTS : has
  APPLICANTS ||--o| STUDENTS : converts_to
  STUDENTS ||--o{ STUDENT_ENROLLMENTS : enrolls
  COHORTS ||--o{ STUDENT_ENROLLMENTS : groups
  TRAINING_PROGRAMS ||--o{ PROGRAM_VERSIONS : versions
  PROGRAM_VERSIONS ||--o{ PROGRAM_SUBJECTS : contains
  SUBJECTS ||--o{ PROGRAM_SUBJECTS : appears_in
  COHORTS ||--o{ CLASS_GROUPS : has
  CLASS_GROUPS ||--o{ TEACHING_ASSIGNMENTS : schedules
  SUBJECTS ||--o{ TEACHING_ASSIGNMENTS : taught_as
  STAFF ||--o{ TEACHING_ASSIGNMENTS : teaches
  TEACHING_ASSIGNMENTS ||--o{ TIMETABLE_SESSIONS : schedules
  TIMETABLE_SESSIONS ||--o| ATTENDANCE_SESSIONS : records
  ATTENDANCE_SESSIONS ||--o{ ATTENDANCE_RECORDS : contains
  STUDENT_ENROLLMENTS ||--o{ ATTENDANCE_RECORDS : attends
  TEACHING_ASSIGNMENTS ||--o{ ASSESSMENT_ITEMS : assesses
  ASSESSMENT_ITEMS ||--o{ GRADE_ENTRIES : scores
  STUDENT_ENROLLMENTS ||--o{ GRADE_ENTRIES : receives
~~~

## 4. Phân quyền và phạm vi dữ liệu

| Vai trò | Phạm vi đề xuất |
|---|---|
| system_admin | Toàn hệ thống, quản trị và phê duyệt; không tự phê duyệt thay đổi của chính mình |
| ban_giam_hieu | Chỉ reports.view; chỉ xem số liệu tổng hợp qua RPC |
| Phòng Đào tạo | Toàn trường trong admissions/training/grades theo nhiệm vụ |
| Phòng Quản lý HSSV | Hồ sơ người học, lớp và biến động theo nhiệm vụ |
| Phòng Tổ chức - Cán bộ | Hồ sơ nhân sự và phân công theo phạm vi |
| Khoa | Nhân sự, lớp, chương trình, giảng dạy và kết quả trong đơn vị được giao |
| Giáo viên | Lớp/học phần được phân công; nhập điểm/chuyên cần theo kỳ |
| Người học | Hồ sơ của bản thân và kết quả được công bố |

RLS phải kiểm tra org_unit_id, class_group_id, teaching_assignment_id và thời hạn phân công. Không dựa vào filter ở frontend.

## 5. Cổng thiết kế trước migration

- Đối chiếu biểu mẫu Excel thực tế của Phòng Đào tạo và các quyết định chương trình.
- Xác định khóa chính, unique constraints, FK, indexes, enum/check constraints và lịch sử thay đổi.
- Thiết kế import có preview, mapping, kiểm tra lỗi và idempotency.
- Thiết kế RLS cho từng vai trò và kiểm thử API trực tiếp.
- Tách Storage bucket, quyền file và signed URL theo hồ sơ.
- Chuẩn bị migration có rollback, backup và kiểm thử trước khi áp dụng.
- Không tạo các bảng này trên Supabase production nếu chưa có phê duyệt riêng.
