# EDU360 — Chặng 8: AI-OFFICE có kiểm soát dữ liệu

Trạng thái: Thiết kế an toàn; chưa kết nối mô hình AI và chưa gửi dữ liệu production tới nhà cung cấp AI.
Ngày: 2026-11-26

## 1. Mục tiêu và nguyên tắc
AI-OFFICE hỗ trợ tra cứu, tổng hợp, soạn thảo. AI không phải nguồn dữ liệu gốc, không tự cấp quyền, không tự phê duyệt và không vượt RLS.
- Chỉ truy xuất dữ liệu người dùng hiện tại được phép đọc.
- Mỗi request xác minh JWT, profile active, role permissions và scope ở backend.
- BGH chỉ có thể truy vấn báo cáo aggregate được cấp reports.view; không truy xuất hồ sơ cá nhân, bảng điểm hoặc chứng từ.
- AI không tự ghi dữ liệu. Mọi thao tác ghi tương lai phải có preview, xác nhận người dùng và RPC nghiệp vụ.
- Không gửi PII, hồ sơ giấy tờ, điểm cá nhân, tài chính chi tiết hoặc bí mật ra model ngoài khi chưa đánh giá/phê duyệt.
- Feature flag mặc định OFF cho đến khi duyệt chính sách dữ liệu, nhà cung cấp, retention và ngân sách.

## 2. Kiến trúc
1. Frontend gửi câu hỏi đến backend/Edge Function, không gọi model trực tiếp.
2. Backend xác minh JWT, active profile, quyền và scope; không tin role/scope do client gửi.
3. Policy router chọn nguồn được phép: báo cáo aggregate, knowledge có ACL hoặc RPC allowlist.
4. ACL filter chạy trước retrieval; RLS vẫn có hiệu lực.
5. Prompt builder chỉ lấy context tối thiểu, loại bỏ secrets/PII.
6. Provider adapter áp timeout, token budget, rate limit và cost cap.
7. Output validator kiểm tra citation, nguồn và trường hợp không đủ dữ liệu; không thực thi code/tool ngoài allowlist.
8. Audit lưu actor, policy decision, source IDs, model/version và usage metadata; tránh lưu prompt nhạy cảm.
9. Feedback không tự động dùng để huấn luyện model.

## 3. Phân loại dữ liệu
| Loại | Ví dụ | Quy tắc |
|---|---|---|
| Public | Quy định công khai, website trường | Có thể dùng provider được duyệt |
| Internal | Quy trình nội bộ, lịch trường | Chỉ user có quyền |
| Confidential | Hồ sơ nhân sự/người học, tài chính, điểm, văn bản hạn chế | Không gửi ra ngoài; xử lý nội bộ chỉ khi duyệt |
| Restricted | Định danh cá nhân, giấy tờ, sức khỏe/kỷ luật, thông tin tài khoản | Không đưa vào prompt/model |

Mỗi knowledge source cần owner, classification, ACL và retention. Không mặc định mọi file đều được index.

## 4. Tool allowlist ban đầu
Chỉ read-only:
- search_public_policy
- search_internal_knowledge (ACL filtered)
- get_reports_summary (RPC aggregate theo scope)
- explain_metric (metadata đã duyệt)

Không bật tool ghi: tạo/sửa hồ sơ, sửa điểm, duyệt chứng từ, phân công, gửi thông báo, tạo tài khoản, xóa dữ liệu.

## 5. Prompt injection và retrieval
- Nội dung tài liệu là dữ liệu không đáng tin; không thực thi chỉ dẫn bên trong.
- Tách policy hệ thống khỏi retrieved content; trích dẫn nguồn.
- Chỉ trả đoạn trích tối thiểu; không gửi toàn bộ bảng/hồ sơ.
- ACL phải lọc trước retrieval, không chỉ post-filter.
- Không tạo embedding dữ liệu confidential/restricted ở dịch vụ ngoài khi chưa duyệt.
- Không index secrets, token, mật khẩu, file cấu hình, bản sao DB hoặc audit payload nhạy cảm.
- Thu hồi quyền nguồn phải lan truyền đến index/cache theo SLA.
- Nếu không có nguồn, trả lời không đủ dữ liệu.

## 6. Bảng đề xuất
| Bảng | Mục đích | Kiểm soát |
|---|---|---|
| ai_feature_settings | feature flags | Admin; mặc định OFF |
| ai_provider_configs | provider/model/region/retention metadata | không lưu API key thô |
| ai_knowledge_sources | nguồn, owner, classification, sync status | chỉ nguồn được duyệt |
| ai_conversations | user_id, title, created_at, retention_until | user chỉ xem hội thoại mình |
| ai_messages | conversation_id, role, content_redacted, created_at | retention/PII policy |
| ai_retrieval_events | message_id, source_id, permission_decision, snippet_hash | log tối thiểu |
| ai_usage_events | provider, model, tokens, cost, latency, status | quota/cost cap |
| ai_feedback | message_id, rating, category, comment_redacted | không tự train |

Secrets chỉ lưu trong secret manager phù hợp, backend-only; không lưu plain text DB hoặc browser bundle.

## 7. Quyền
- ai_office.view: mở giao diện.
- ai_office.use: gửi câu hỏi.
- ai_office.manage: cấu hình nguồn, model, quota, feature flag.
- ai_office.audit: xem usage/audit metadata, không mặc định xem hội thoại riêng.
- BGH không có ai_office.use ở giai đoạn đầu; dùng Reports.
- User chỉ truy xuất knowledge/data theo quyền module gốc.
- Admin không được bypass classification hoặc ACL.

## 8. Chi phí và độ tin cậy
- Allowlist provider/model; client không tự chọn endpoint.
- Rate limit theo user/role, giới hạn tokens.
- Budget ngày/tháng, kill switch toàn hệ thống.
- Timeout, retry giới hạn, circuit breaker.
- Câu trả lời dữ liệu nội bộ phải có citation, thời điểm dữ liệu và nguồn.
- Không dùng AI tự động chấm điểm, quyết định tuyển sinh, xếp loại, kỷ luật hoặc xét tốt nghiệp.

## 9. Kiểm thử an toàn
1. User A không nhận dữ liệu User/Unit B.
2. BGH hỏi danh sách học sinh/điểm cá nhân vẫn chỉ nhận aggregate hoặc bị từ chối.
3. Prompt injection trong tài liệu không đổi policy hoặc gọi tool ngoài allowlist.
4. Thu hồi quyền chặn retrieval tiếp theo; cache không giữ quyền cũ quá SLA.
5. Feature flag OFF thì backend từ chối dù frontend gọi trực tiếp.
6. Không lộ API key trong bundle/logs/responses/repository.
7. Quota/cost cap hoạt động; provider lỗi không làm lộ dữ liệu.
8. Retention và xóa hội thoại theo chính sách.
9. Không có tool ghi dữ liệu trong cấu hình ban đầu.
10. Kiểm thử audit, citations và hallucination fallback.

## 10. Cổng triển khai
- [ ] Ban hành chính sách AI và phân loại dữ liệu.
- [ ] Chọn provider, vùng xử lý, retention, điều khoản.
- [ ] Duyệt knowledge sources và ACL.
- [ ] Duyệt budget, quota, model allowlist và feature flag.
- [ ] Triển khai backend proxy.
- [ ] Kiểm thử prompt injection, ACL, leakage, cost và audit.
- [ ] Chỉ bật flag sau phê duyệt; mặc định OFF.
