# EDU360 — Hệ thống quản trị trường học

Trường Trung học nghề Đông Nam Nghệ An.

EDU360 là hệ thống quản trị nhà trường thống nhất, phát triển theo từng giai đoạn trên nền tảng React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query và Supabase.

## Công nghệ

- React 18, TypeScript, Vite
- Tailwind CSS, React Router
- TanStack Query, React Hook Form, Zod
- Supabase Auth, PostgreSQL và Row Level Security (RLS)

## Chạy cục bộ

```bash
npm install
cp .env.example .env
# Điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY bằng khóa công khai của dự án
npm run dev
```

Kiểm tra mã nguồn và build:

```bash
npm run typecheck
npm run build
```

## Supabase

Dự án sử dụng Supabase EDU360 (`akckcnijujtevfbginja`), khu vực `ap-southeast-1`.

Frontend chỉ được sử dụng publishable key hoặc anon key. Tuyệt đối không đưa `service_role` key hoặc secret key vào mã nguồn frontend hay biến môi trường có tiền tố `VITE_`.

Phân quyền dữ liệu phải được thực thi tại PostgreSQL bằng RLS. Kiểm tra quyền ở giao diện chỉ nhằm cải thiện trải nghiệm, không thay thế RLS.

## Cấu hình môi trường

Các biến môi trường cần thiết:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DEMO_DATA` (chỉ bật dữ liệu minh họa khi chủ động đặt `true`; production phải tắt)

Không commit tệp `.env` hoặc bất kỳ bí mật nào.

## Tình trạng triển khai

Repository hiện có khung ứng dụng, đăng nhập Supabase, quản lý phiên đăng nhập, dashboard, sidebar và điều hướng các phân hệ. Cơ chế kiểm tra trạng thái hồ sơ, nạp quyền từ RPC, lọc menu theo quyền và các phân hệ nghiệp vụ đang tiếp tục được hoàn thiện.

## Nguyên tắc phát triển

- Tiếp tục trên repository hiện có, không tạo dự án thay thế.
- Không tự ý thay đổi schema, migration, RLS, dữ liệu hoặc quyền trong Supabase.
- Không đưa dữ liệu demo vào quy trình production.
- Mọi thay đổi cần được kiểm tra TypeScript, test phù hợp và production build trước khi phát hành.
