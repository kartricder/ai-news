# Handover Phase 2

## Đã hoàn thành

- `POST /api/crawl/trigger` gọi crawler thật và được bảo vệ admin.
- Thêm `npm run crawl` chạy crawler CLI.
- Crawler không crash toàn run khi từng nguồn lỗi; lỗi được ghi vào `CrawlRun.errorMessage`.
- Dedupe bằng `contentHash`, `originalUrl`, canonical URL và title similarity.
- Set `publishedAt` khi auto publish và khi admin đổi status sang `published`.
- Sửa score distribution về `0-20`, `21-40`, `41-60`, `61-80`, `81-100`.
- Tạo trang chi tiết `/articles/[slug]`.
- Chuẩn hóa login bằng JWT cookie `auth_token`, thêm logout.
- Tạo admin dashboard, articles, sources, settings, telegram, crawl logs.
- Bảo vệ API nhạy cảm: admin, crawl, telegram, PATCH articles.
- Telegram token được lưu encrypted và chỉ trả masked.
- Scheduler đọc setting/env và có guard tránh nhiều instance trong cùng process.
- Cập nhật README và deploy guide VPS.

## File chính đã sửa/thêm

- `src/crawlers/*`
- `src/app/api/crawl/trigger/route.ts`
- `src/app/api/articles/*`
- `src/app/api/admin/*`
- `src/app/api/telegram/*`
- `src/app/admin/*`
- `src/app/articles/[slug]/page.tsx`
- `src/lib/auth.ts`, `src/lib/authGuard.ts`, `src/lib/settings.ts`, `src/lib/scheduler.ts`
- `src/proxy.ts`
- `prisma/schema.prisma`, `prisma/seed.ts`
- `README.md`, `DEPLOY_VPS.md`, `HANDOVER_PHASE2.md`

## API thay đổi

- Login không trả raw token để frontend tự lưu nữa; server set cookie httpOnly.
- Public `GET /api/articles` bị giới hạn về `published`.
- Admin article list dùng cùng endpoint nhưng cần cookie admin.
- Telegram config không expose full token.
- Crawl trigger trả `totalFetched`, `totalPublished`, `totalPending`, `totalRejected`, `totalDuplicates`, `errors`, `details`.

## Cách test

```bash
npm run lint
npm run build
npx prisma migrate dev
npx prisma db seed
npm run crawl
npm run dev
```

Smoke test:

- Mở `/` thấy danh sách bài published.
- Mở `/articles/{slug}` từ card.
- Mở `/admin/login`, đăng nhập.
- Mở `/admin`, `/admin/articles`, `/admin/sources`, `/admin/settings`, `/admin/telegram`, `/admin/crawl-logs`.
- Chạy crawl từ `/admin/crawl-logs`.
- Nếu có Telegram token/chat id, dùng nút gửi thử; nếu chưa có, API trả lỗi cấu hình nhưng app không crash.

## Đề xuất Phase 3

- Tích hợp AI dịch/tóm tắt tiếng Việt bằng LLM.
- Thêm queue/background job nếu crawler lớn hơn.
- Thêm test tự động Playwright/API.
- Thêm PostgreSQL cho production lớn hơn.
- Thêm phân quyền multi-user nếu vận hành bởi nhiều người.
