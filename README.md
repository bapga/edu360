# EDU360 - Hệ thống quản trị trường học

Trường Trung học nghề Đông Nam Nghệ An.

Công nghệ: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Supabase.

## Chạy cục bộ

    npm install
    cp .env.example .env     # điền VITE_SUPABASE_ANON_KEY (khóa công khai)
    npm run dev
    npm run build

## Supabase

Project: EDU360 (`akckcnijujtevfbginja`), vùng ap-southeast-1.
Chỉ dùng khóa công khai ở frontend. Không đưa service role key vào mã nguồn hay biến `VITE_*`.
Phân quyền được thực thi bằng RLS tại PostgreSQL.

## Dữ liệu mẫu

`VITE_DEMO_DATA=true` hiển thị dữ liệu mẫu trên dashboard (development/preview).
Production đặt `false` hoặc bỏ trống: dashboard hiển thị trạng thái trống.

## Trạng thái

Đã có: khung ứng dụng, sidebar thu gọn, header, breadcrumb, tìm phân hệ, dashboard.
Chưa có: đăng nhập, PWA, các phân hệ nghiệp vụ (xem lộ trình Giai đoạn 2-10).
