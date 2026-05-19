# AI News Việt Nam

MVP tổng hợp tin tức AI bằng Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Prisma 7 và SQLite. Luồng chính: crawl nguồn RSS/Hacker News/Reddit/GitHub, chấm điểm 0-100, chống trùng, lưu DB, auto publish theo threshold, hiển thị public và quản trị qua admin.

## Chạy local

1. Cài dependency:

```bash
npm install
```

Nếu đổi phiên bản Node và gặp lỗi `better-sqlite3` native module, chạy:

```bash
npm rebuild better-sqlite3
```

2. Tạo `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Các biến quan trọng:

- `DATABASE_URL="file:./dev.db"`: SQLite dùng bởi Prisma.
- `APP_BASE_URL="http://localhost:3000"`: URL web để server fetch API nội bộ.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`: tài khoản admin. Không dùng password mặc định ở production.
- `ENCRYPTION_KEY`: dùng ký JWT và encrypt Telegram setting.
- `GITHUB_TOKEN`: optional, dùng tăng rate limit GitHub crawler.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: optional, cũng có thể cấu hình trong `/admin/telegram`.

3. Migration và seed:

```bash
npm run db:migrate
npm run db:seed
```

4. Chạy crawler thủ công:

```bash
npm run crawl
```

5. Chạy web:

```bash
npm run dev
```

Mở `http://localhost:3000`.

## Scripts

- `npm run dev`: chạy Next dev server.
- `npm run build`: build production.
- `npm run start`: chạy production build.
- `npm run lint`: ESLint.
- `npm run db:migrate`: Prisma migrate dev.
- `npm run db:seed`: seed source và setting mặc định.
- `npm run crawl`: chạy crawler thật từ CLI.

## Docker optional

Repo có `Dockerfile` và `docker-compose.yml` tối thiểu để chạy sandbox/container. Với VPS thật, tài liệu `DEPLOY_VPS.md` khuyến nghị PM2 + Nginx + system cron để vận hành SQLite rõ ràng hơn.

## Admin

Đăng nhập tại `/admin/login` bằng `ADMIN_USERNAME`/`ADMIN_PASSWORD`. Login set cookie `auth_token` dạng httpOnly, sameSite lax, secure khi production.

Các màn hình chính:

- `/admin`: dashboard tổng số bài, trạng thái nguồn, Telegram, crawl gần nhất.
- `/admin/articles`: lọc/tìm bài, publish/reject, sửa summary/content/category/tags.
- `/admin/sources`: bật/tắt source, sửa URL, thêm RSS custom.
- `/admin/settings`: sửa publish threshold, pending threshold, cron schedule, app base URL.
- `/admin/telegram`: lưu Telegram token/chat id encrypted, gửi tin nhắn test.
- `/admin/crawl-logs`: xem log và chạy crawl thủ công.

## API chính

- `GET /api/articles`: public chỉ trả bài `published`; admin có thể lọc mọi status.
- `GET /api/articles/{slug}`: public chỉ xem bài `published`.
- `PATCH /api/articles/{slug}`: admin only.
- `POST /api/crawl/trigger`: admin only, chạy crawler thật.
- `GET /api/crawl/trigger`: admin only, xem crawl logs.
- `GET/PUT /api/telegram/config`: admin only, token masked khi trả về.
- `POST /api/telegram/test`: admin only.
- `GET/PUT /api/admin/settings`: admin only.
- `GET/POST/PATCH /api/admin/sources`: admin only.

## Crawler và dedupe

Crawler đọc source bật trong DB. RSS custom phải có `Source.name` trùng `article.sourceName`, lớp lưu DB sẽ bỏ qua bài nếu source name không tồn tại.

Chống trùng dùng:

- `contentHash` từ URL chuẩn hóa + title.
- `originalUrl` trùng.
- `sourceUrl` trùng khi đó là URL canonical của bài.
- title gần giống khi cùng source/canonical URL.

Khi `status = published`, hệ thống set `publishedAt` nếu chưa có, bao gồm cả auto publish từ crawler và publish bằng admin.

## Telegram

Nếu chưa cấu hình Telegram, crawler không crash và chỉ bỏ qua gửi thông báo. Khi cấu hình đúng, các bài mới được publish trong run sẽ gửi digest. API không trả token đầy đủ về frontend.

## Backup SQLite

Tắt app hoặc đảm bảo không có migration/crawl đang ghi DB, rồi copy file:

```bash
cp prisma/dev.db backups/dev-$(date +%F).db
```

Restore:

```bash
cp backups/dev-YYYY-MM-DD.db prisma/dev.db
```

## Troubleshooting

- `better-sqlite3` báo `NODE_MODULE_VERSION`: chạy `npm rebuild better-sqlite3`.
- Build báo lock `.next`: dừng `next dev`, xóa `.next`, build lại.
- Admin login fail ở production: kiểm tra `ADMIN_PASSWORD` không để mặc định/empty.
- Telegram test fail: kiểm tra bot token, chat id và bot đã có quyền gửi vào chat.
- RSS 404: sửa URL source trong `/admin/sources`.
