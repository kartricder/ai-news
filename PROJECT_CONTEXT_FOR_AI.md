# PROJECT CONTEXT FOR AI

> Bản đồ dự án dành cho AI/lập trình viên tiếp nhận. Bám sát source code tại thời điểm phân tích — không thay thế việc đọc file khi sửa logic cụ thể.

---

## 1. Tóm tắt ngắn gọn project

**AI News Việt Nam** (`package.json`: `ai-news`) là web app **tổng hợp tin AI tự động**. Hệ thống crawl bài từ RSS blog, Hacker News, Reddit, GitHub; chấm điểm quan trọng (0–100); lưu SQLite; hiển thị bài `published` trên trang chủ. Có thể gửi thông báo Telegram nếu cấu hình trong DB.

**Đối tượng:** độc giả xem tin AI (public); admin vận hành qua API (UI admin chưa có).

**Bài toán chính:** giảm effort theo dõi nhiều nguồn AI, lọc tin theo rule-based scoring thay vì hiển thị tất cả.

**Trạng thái:** **MVP / prototype gần chạy được end-to-end**. Crawl thật qua script CLI; API trigger vẫn mock; thiếu trang chi tiết bài và admin UI; auth chưa thống nhất. **Không production-ready.**

**Nguồn dữ liệu:** API bên ngoài (RSS, HN Firebase, Reddit JSON, GitHub Search) → lưu **SQLite** (`prisma/dev.db`). **Không có AI service** (không dịch/tóm tắt bằng LLM trong code hiện tại). Field `summaryVi`/`contentVi` thường là snippet tiếng Anh từ nguồn.

---

## 2. Stack công nghệ

| Lớp hệ thống | Công nghệ | File liên quan | Ghi chú |
|---|---|---|---|
| Frontend | Next.js 16 App Router + React 19 | `src/app/`, `src/components/` | Chỉ có `/` (trang chủ); không có `/articles/[slug]`, `/admin` |
| Backend | Next.js Route Handlers | `src/app/api/**/route.ts` | Không có Express/Fastify riêng |
| Database | SQLite file | `prisma/dev.db`, `prisma/schema.prisma` | Runtime hardcode path trong `src/lib/prisma.ts` |
| ORM | Prisma 7.8 | `prisma/`, `src/lib/prisma.ts` | Bắt buộc adapter `@prisma/adapter-better-sqlite3` |
| DB driver | better-sqlite3 | `src/lib/prisma.ts`, `prisma/seed.ts` | Cần `npm rebuild better-sqlite3` nếu thiếu `.node` trên Windows |
| Styling | Tailwind CSS 4 | `src/app/globals.css`, `postcss.config.mjs` | Dark theme, tiếng Việt UI |
| RSS | rss-parser | `src/crawlers/RSSCrawler.ts` | Feed URL hardcode trong crawler |
| Scheduling | node-cron | `src/lib/scheduler.ts` | **Chưa được gọi** khi app start |
| Auth | Cookie + env password + JWT helper | `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/jwt.ts` | Login API không set cookie; JWT chưa wired |
| Mã hóa setting | crypto-js AES | `src/lib/crypto.ts`, `src/lib/settings.ts` | Key từ `ENCRYPTION_KEY` env |
| Telegram | Telegram Bot HTTP API | `src/lib/telegram.ts` | Token/chat id đọc từ bảng `AppSetting` |
| Build | Next.js (Turbopack dev) | `next.config.ts`, `package.json` | |
| Package manager | npm | `package-lock.json` | |
| Thư viện AI/LLM | **Không có** | — | Cần xác minh trước khi thêm tính năng dịch AI |
| Chart/UI lib | **Không có** | — | Stats chỉ qua API JSON |
| Deploy | **Không có** trong repo | — | Không Dockerfile, CI, PM2, Nginx |

---

## 3. Cấu trúc thư mục quan trọng

```bash
ai-news/
├── prisma/
│   ├── schema.prisma          # 5 models: Article, Source, CrawlRun, AppSetting, TelegramLog
│   ├── seed.ts                # 10 Source + 8 AppSetting
│   ├── dev.db                 # SQLite runtime (gitignored)
│   └── migrations/
├── scripts/
│   ├── run-crawl.ts           # ✅ Chạy crawl thật → ghi DB
│   └── crawl-direct.ts        # Debug sourceName mapping (fetch only, không ghi DB)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Trang chủ — fetch GET /api/articles?status=published
│   │   ├── layout.tsx         # Navbar + metadata
│   │   └── api/               # Toàn bộ REST API
│   ├── crawlers/              # ★ Pipeline crawl chính (class-based)
│   │   ├── BaseSourceCrawler.ts
│   │   ├── RSSCrawler.ts | HackerNewsCrawler.ts | RedditCrawler.ts | GitHubTrendingCrawler.ts
│   │   └── index.ts           # runAllCrawlers()
│   ├── scoring/index.ts       # ★ calculateScore() — engine đang dùng
│   ├── lib/                   # Hạ tầng: prisma, scheduler, telegram, settings...
│   ├── components/            # ArticleCard, Navbar, Pagination*, StatusBadge*
│   ├── types/index.ts         # ArticleData, AppSettings, AnalyticsStats
│   └── middleware.ts          # Bảo vệ /admin, /api/admin/*
├── .env.example
├── prisma.config.ts           # Prisma CLI: DATABASE_URL, seed command
├── README.md                  # Tài liệu đầy đủ (dài)
└── PROJECT_CONTEXT_FOR_AI.md  # File này
```

`*` = component tồn tại nhưng chưa dùng đầy đủ hoặc import thừa.

### Dead code (không import — có thể xóa hoặc bỏ qua)

| File | Ghi chú |
|------|---------|
| `src/lib/scoring.ts` | Bản scoring cũ |
| `src/lib/crawlers/index.ts` | Crawler functional cũ |
| `src/lib/types.ts` | Type legacy |

---

## 4. Luồng dữ liệu cốt lõi

```
External APIs (RSS/HN/Reddit/GitHub)
    → Crawler.fetch()           [src/crawlers/*.ts]
    → calculateScore()          [src/scoring/index.ts]
    → gán status theo AppSetting [publish_threshold=75, pending_threshold=60]
    → saveToDatabase()          [BaseSourceCrawler — CHỈ insert nếu Source.name === article.sourceName]
    → SQLite Article
    → GET /api/articles         [src/app/api/articles/route.ts]
    → page.tsx render ArticleCard
```

**Scheduler (chưa auto-run):** `src/lib/scheduler.ts` → `runAllCrawlers()` → `notifyNewArticles()` / `postDailySummary()` qua `src/lib/telegram.ts`.

**Crawl thực tế hiện tại:** `npx tsx scripts/run-crawl.ts` — **không** qua `/api/crawl/trigger` (endpoint đó vẫn mock).

---

## 5. Database (Prisma)

Schema: `prisma/schema.prisma`. Provider: **sqlite**.

| Model | Vai trò | Mở rộng |
|-------|---------|---------|
| **Article** | Bài đã crawl | Thêm cột → sửa schema + migration + `ArticleData` trong `src/types/index.ts` + crawler mapping |
| **Source** | Catalog nguồn (name unique) | Thêm nguồn → `prisma/seed.ts` + map `sourceName` trong crawler tương ứng |
| **CrawlRun** | Log mỗi lần crawl | Tự ghi qua `src/lib/crawlRun.ts` |
| **AppSetting** | key-value config | Thêm key → seed + `getAppSettings()` trong `src/lib/settings.ts` nếu cần typed |
| **TelegramLog** | Log gửi Telegram | Ghi qua `src/lib/telegram.ts` |

### Ràng buộc quan trọng khi lưu bài

```typescript
// BaseSourceCrawler.saveToDatabase()
const source = await prisma.source.findFirst({ where: { name: article.sourceName } });
if (!source) continue; // bỏ qua bài
```

**Source names hợp lệ (seed):** `OpenAI Blog`, `Anthropic Blog`, `Google AI Blog`, `Meta AI Blog`, `DeepMind Blog`, `GitHub Trending`, `Hacker News`, `Reddit r/LocalLLaMA`, `Reddit r/MachineLearning`, `Reddit r/OpenAI`.

### Bug / gap DB cần biết

- `publishedAt` **không được set** khi `status = published` → scheduler filter `publishedAt` có thể bỏ sót bài mới.
- `contentHash` được tính nhưng **không dùng** để chặn duplicate (chỉ check slug).
- Admin stats `scoreDistribution` dùng range 0–10 trong khi score thực 0–100 (`src/app/api/admin/stats/route.ts`).

---

## 6. API map

Base: `http://localhost:3000` (hoặc `APP_BASE_URL`).

| Method | Path | Auth | File | Ghi chú |
|--------|------|------|------|---------|
| GET | `/api/articles` | Public | `src/app/api/articles/route.ts` | Query: status, category, search, sort, page |
| GET | `/api/articles/{slug}` | Public nếu published | `src/app/api/articles/[...id]/route.ts` | |
| PATCH | `/api/articles/{slug}` | **Không check auth** | same | Sửa status, summaryVi, contentVi, ... |
| POST | `/api/admin/login` | Public | `src/app/api/admin/login/route.ts` | So `ADMIN_*` env; trả JSON token, **không set cookie** |
| GET | `/api/admin/stats` | Cookie `auth_token` | `src/app/api/admin/stats/route.ts` | Middleware |
| GET/PUT | `/api/admin/settings` | Cookie | `src/app/api/admin/settings/route.ts` | |
| POST | `/api/crawl/trigger` | **Không** | `src/app/api/crawl/trigger/route.ts` | **MOCK** — cần sửa gọi `runAllCrawlers()` |
| GET | `/api/crawl/trigger` | Public | same | List CrawlRun |
| GET/PUT | `/api/telegram/config` | **Không** | `src/app/api/telegram/config/route.ts` | Cần xác minh: có nên bảo vệ admin? |
| POST | `/api/telegram/test` | **Không** | `src/app/api/telegram/test/route.ts` | |

**Middleware:** `src/middleware.ts` — matcher: `/admin/:path*`, `/api/admin/:path*`.

---

## 7. Module & trách nhiệm

| Module | Entry point | Trách nhiệm |
|--------|-------------|-------------|
| Crawlers | `src/crawlers/index.ts` → `runAllCrawlers()` | Thu thập + score + save |
| Scoring | `src/scoring/index.ts` → `calculateScore()` | Rule-based 0–100 |
| Settings | `src/lib/settings.ts` | Đọc/ghi `AppSetting`, decrypt nếu `encrypted` |
| Scheduler | `src/lib/scheduler.ts` | Cron wrapper; gọi crawl + Telegram |
| Telegram | `src/lib/telegram.ts` | sendMessage, notifyNewArticles, postDailySummary |
| Prisma client | `src/lib/prisma.ts` | Singleton; path cố định `prisma/dev.db` |
| UI public | `src/app/page.tsx` | Server fetch API → grid ArticleCard |
| Types | `src/types/index.ts` | `ArticleData`, `AppSettings`, ... |

---

## 8. Cách mở rộng tính năng (cheat sheet)

### Thêm nguồn tin mới

1. `prisma/seed.ts` — thêm `{ name, type, url, enabled }` (name **unique**).
2. Crawler tương ứng — set `article.sourceName` **đúng tên seed**.
3. `npx prisma db seed`.

### Thêm loại crawler mới

1. Tạo `src/crawlers/MyCrawler.ts` extends `BaseSourceCrawler`.
2. Implement `fetch(): Promise<ArticleData[]>`.
3. Đăng ký trong `src/crawlers/index.ts` mảng `crawlers`.
4. (Tuỳ chọn) thêm `Source` seed với `type` mới.

### Nối crawl vào API (fix mock)

Sửa `src/app/api/crawl/trigger/route.ts`:

```typescript
import { runAllCrawlers } from '@/crawlers';
// POST: await runAllCrawlers() thay mock
```

Cân nhắc: crawl lâu → chạy background job hoặc trả 202 + poll CrawlRun.

### Thêm trang chi tiết bài

1. Tạo `src/app/articles/[slug]/page.tsx`.
2. Fetch `GET /api/articles/{slug}` hoặc gọi `prisma` trực tiếp (Server Component).
3. `ArticleCard` đã link `/articles/${slug}` — sẵn sàng.

### Thêm admin UI

1. `src/app/admin/login/page.tsx` — POST `/api/admin/login`, **set cookie** `auth_token`.
2. `src/app/admin/page.tsx` — fetch `/api/admin/stats`, `/api/admin/settings`.
3. Dùng `src/lib/jwt.ts` thay token base64 demo.

### Thêm dịch tiếng Việt (AI)

**Chưa có trong code.** Gợi ý hook:

- Sau `validateAndScore()` hoặc trước `saveToDatabase()` trong `BaseSourceCrawler`.
- Hoặc job riêng: đọc `Article` status `pending` → gọi LLM → cập nhật `summaryVi`/`contentVi`.
- Thêm env keys + service mới trong `src/lib/` (ví dụ `src/lib/translate.ts`).

### Thêm bảng DB mới

1. Sửa `prisma/schema.prisma`.
2. `npx prisma migrate dev`.
3. Thêm type TS nếu cần (`src/types/index.ts`).
4. API route mới dưới `src/app/api/`.

### Tự động chạy scheduler

Tạo `src/instrumentation.ts` (Next.js) gọi `startScheduler()` — **Cần xác minh** convention Next.js 16 cho instrumentation trong repo này (chưa có file).

### Đổi sang MySQL

**Chưa hỗ trợ.** Cần: đổi `provider` schema, adapter Prisma 7 cho MySQL/MariaDB, sửa `src/lib/prisma.ts`, `prisma/seed.ts`, migration lại.

---

## 9. Biến môi trường (`.env.example`)

| Biến | Dùng thực tế? | Ghi chú |
|------|---------------|---------|
| `DATABASE_URL` | Prisma CLI only | Runtime app **không** đọc |
| `APP_BASE_URL` | ✅ | `src/app/page.tsx` fetch API server-side |
| `ADMIN_USERNAME/PASSWORD` | ✅ | Login API |
| `ENCRYPTION_KEY` | ✅ | crypto + jwt secret |
| `GITHUB_TOKEN` | ❌ | Cần xác minh — không grep thấy dùng |
| `CRON_SCHEDULE` | ❌ | Scheduler hardcode `0 0,6,12,18 * * *` |
| `TELEGRAM_*` env | ❌ runtime | Telegram đọc từ DB `AppSetting` |

---

## 10. Scripts vận hành

```bash
npm run dev              # Dev server :3000
npx prisma migrate dev   # Migration
npx prisma db seed       # Seed sources/settings
npx tsx scripts/run-crawl.ts      # Crawl thật → có bài trên trang chủ
npx tsx scripts/crawl-direct.ts   # Debug sourceName (không ghi DB)
npm rebuild better-sqlite3          # Fix native binding trên Windows
```

---

## 11. Trang UI hiện có vs thiếu

| Route | Trạng thái |
|-------|-----------|
| `/` | ✅ Có |
| `/articles/[slug]` | ❌ Chưa có (ArticleCard link tới → 404) |
| `/admin`, `/admin/login` | ❌ Chưa có (Navbar có link) |

---

## 12. Checklist tiếp nhận nhanh

- [ ] Đọc `prisma/schema.prisma` + `src/crawlers/BaseSourceCrawler.ts`
- [ ] Hiểu rule `Source.name === article.sourceName`
- [ ] Biết crawl thật = `scripts/run-crawl.ts`, không phải API trigger
- [ ] Sửa auth trước khi expose admin ra internet
- [ ] Bỏ qua `src/lib/scoring.ts`, `src/lib/crawlers/` (dead code)
- [ ] Đọc `README.md` nếu cần chi tiết vận hành đầy đủ

---

## 13. Ưu tiên phát triển đề xuất (theo impact)

1. Wire `/api/crawl/trigger` → `runAllCrawlers()`
2. Trang `/articles/[slug]`
3. Admin UI + auth cookie/JWT thống nhất
4. Set `publishedAt` khi publish
5. `instrumentation.ts` cho scheduler
6. Dedupe bằng `contentHash`
7. (Product) Pipeline dịch `summaryVi` bằng LLM

---

*Tài liệu sinh từ phân tích source. Khi code thay đổi, cập nhật file này cùng commit.*
