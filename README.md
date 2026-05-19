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

- `DATABASE_URL="file:./prisma/dev.db"`: SQLite dùng bởi Prisma và runtime app.
- `APP_BASE_URL="http://localhost:3000"`: URL web để server fetch API nội bộ.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`: tài khoản admin. Không dùng password mặc định ở production.
- `ENCRYPTION_KEY`: dùng ký JWT và encrypt Telegram setting.
- `GITHUB_TOKEN`: optional, dùng tăng rate limit GitHub crawler.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: optional, cũng có thể cấu hình trong `/admin/telegram`.
- `OPENROUTER_API_KEY`: server-side key để dịch title/brief và viết lý do quan trọng.
- `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`, `OPENROUTER_SECOND_FALLBACK_MODEL`: model chính và fallback qua OpenRouter.
- `MAX_PUBLISH_PER_CRAWL=10`, `MIN_SCORE_TO_PUBLISH=75`: giới hạn mỗi lần crawl chỉ publish tối đa 10 tin có điểm cao nhất.
- `AI_TRANSLATION_ENABLED`, `AI_IMPORTANCE_REASON_ENABLED`, `ALLOW_PUBLISH_WITHOUT_AI`: bật/tắt xử lý AI và fallback publish khi AI lỗi.
- `CRON_SECRET`: secret cho endpoint HTTP cron `/api/cron/crawl`.

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
- `npm run cron:crawl`: chạy pipeline crawl thật cho system cron.

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
- `/admin/repo-radar`: xem repo AI nổi bật, ignore/track hoặc publish thành bài.

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
- `GET /api/admin/crawl-runs`: admin only, xem 50 crawl run gần nhất.
- `GET/PATCH /api/admin/repo-radar`: admin only, quản lý Repo Radar.
- `POST /api/admin/repo-radar/{id}/publish`: admin only, publish repo thành article.
- `POST /api/admin/test-ai-translation`: admin only, test OpenRouter translation.
- `GET/POST /api/cron/crawl`: cron endpoint, bắt buộc `CRON_SECRET` qua query `?secret=` hoặc header `x-cron-secret`.

## AI Intelligence pipeline

Pipeline crawl hiện tại chay theo thứ tự: tạo `CrawlRun`, fetch candidate từ RSS/Hacker News/Reddit/GitHub, chuẩn hóa URL canonical, chấm điểm rule-based, loại trùng, sắp xếp theo `importanceScore`, rồi chỉ chọn tối đa `MAX_PUBLISH_PER_CRAWL` bài đạt `MIN_SCORE_TO_PUBLISH` để gọi OpenRouter.

AI dịch title/brief sang tiếng Việt, viết `whyImportant`, `aiTags`, `targetAudience` và `impactLevel`. Bài AI thành công được publish và gửi Telegram từng bài. Nếu AI lỗi, bài chuyển `pending` với `aiStatus/aiError`, trừ khi `ALLOW_PUBLISH_WITHOUT_AI=true`.

OpenRouter dùng `openrouter/auto`, fallback sang `google/gemini-2.5-flash` rồi `mistralai/mistral-small-3.2-24b-instruct`. Output AI phải là JSON hợp lệ; lỗi timeout, rate limit, invalid key, model unavailable hoặc JSON parse failed không làm crash crawler.

## Cron

Ưu tiên system cron trên VPS:

```cron
0 6 * * * cd /path/to/ai-news && npm run cron:crawl >> logs/cron-crawl.log 2>&1
```

Nếu dùng Docker:

```cron
0 6 * * * cd /path/to/ai-news && docker compose exec -T ai-news npm run cron:crawl >> logs/cron-crawl.log 2>&1
```

HTTP cron chỉ nên dùng khi có cron service bên ngoài:

```bash
curl -X POST "https://your-domain.com/api/cron/crawl?secret=$CRON_SECRET"
```

Không để `CRON_SECRET` rỗng trong production.

## Crawler và dedupe

Crawler đọc source bật trong DB. RSS custom phải có `Source.name` trùng `article.sourceName`, lớp lưu DB sẽ bỏ qua bài nếu source name không tồn tại.

Chống trùng dùng:

- `contentHash` từ URL chuẩn hóa + title.
- `originalUrl` trùng.
- `sourceUrl` trùng khi đó là URL canonical của bài.
- title gần giống khi cùng source/canonical URL.
- title gần giống với bài published/pending trong 30 ngày gần nhất.

Khi `status = published`, hệ thống set `publishedAt` nếu chưa có, bao gồm cả auto publish từ crawler và publish bằng admin.

## Telegram

Nếu chưa cấu hình Telegram, crawler không crash và ghi log failed. Khi cấu hình đúng, mỗi bài published trong run sẽ gửi riêng một tin Telegram và set `telegramSent=true`. API không trả token đầy đủ về frontend.

## Repo Radar

Repo Radar lấy GitHub Search API theo các topic AI/LLM/RAG/agent/multimodal, chấm `repoScore`, lưu vào bảng `RepoRadarItem`, và chỉ gọi AI cho tối đa `MAX_REPO_RADAR_AI_PER_CRAWL` repo mới/top mỗi lần crawl. Trang chủ hiển thị section Repo Radar; admin có thể publish repo thành article riêng.

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
