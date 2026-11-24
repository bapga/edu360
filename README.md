# EDU360 - Hệ thống quản trị trường học

Trường Trung học nghề Đông Nam Nghệ An.

Công nghệ: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Supabase.

## Chạy cục bộ

    npm install
    cp .env.example .env
    npm run dev
    npm run build

## Supabase

Project EDU360: `akckcnijujtevfbginja` (ap-southeast-1). Frontend chỉ dùng publishable/anon key; không đưa service role key vào biến `VITE_*`. Phân quyền dữ liệu được thực thi bằng RLS tại PostgreSQL.

## Trạng thái

Đã có khung ứng dụng, sidebar, header, dashboard và điều hướng. Các phân hệ nghiệp vụ sẽ được triển khai theo lộ trình EDU360.