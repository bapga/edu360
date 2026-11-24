# EDU360 - Hệ thống quản trị trường học

Trường Trung học nghề Đông Nam Nghệ An.

Công nghệ: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Supabase.

## Chạy cục bộ

    npm install
<<<<<<< HEAD
    cp .env.example .env     # điền VITE_SUPABASE_ANON_KEY (khóa công khai)
=======
    cp .env.example .env
>>>>>>> 891be7a028beb278bc0477bc36bd9cf7faac2646
    npm run dev
    npm run build

## Supabase

<<<<<<< HEAD
Project: EDU360 (`akckcnijujtevfbginja`), vùng ap-southeast-1.
Chỉ dùng khóa công khai ở frontend. Không đưa service role key vào mã nguồn hay biến `VITE_*`.
Phân quyền được thực thi bằng RLS tại PostgreSQL.

## Dữ liệu mẫu

`VITE_DEMO_DATA=true` hiển thị dữ liệu mẫu trên dashboard (development/preview).
Production đặt `false` hoặc bỏ trống: dashboard hiển thị trạng thái trống.

## Trạng thái

Đã có: khung ứng dụng, sidebar thu gọn, header, breadcrumb, tìm phân hệ, dashboard.
Chưa có: đăng nhập, PWA, các phân hệ nghiệp vụ (xem lộ trình Giai đoạn 2-10).
=======
Project EDU360: `akckcnijujtevfbginja` (ap-southeast-1). Frontend chỉ dùng publishable/anon key; không đưa service role key vào biến `VITE_*`. Phân quyền dữ liệu được thực thi bằng RLS tại PostgreSQL.

## Trạng thái

Đã có khung ứng dụng, sidebar, header, dashboard và điều hướng. Các phân hệ nghiệp vụ sẽ được triển khai theo lộ trình EDU360.
>>>>>>> 891be7a028beb278bc0477bc36bd9cf7faac2646
