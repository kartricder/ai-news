# AI News Việt Nam

Hệ thống tổng hợp tin tức AI tự động: thu thập bài từ RSS, Hacker News, Reddit và GitHub, chấm điểm mức độ quan trọng, phân loại xuất bản và hiển thị trên web. Hỗ trợ thông báo qua Telegram (tùy chọn).

> Tài liệu này mô tả source code hiện tại của project `ai-news` (Next.js 16, Prisma 7, SQLite).

---

## Mục lục

1. [Tổng quan project](#1-tổng-quan-project)
2. [Công nghệ sử dụng](#2-công-nghệ-sử-dụng)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Kiến trúc & luồng hoạt động](#4-kiến-trúc--luồng-hoạt-động)
5. [Mô hình dữ liệu](#5-mô-hình-dữ-liệu)
6. [API Reference](#6-api-reference)
7. [Cấu hình môi trường](#7-cấu-hình-môi-trường)
8. [Cài đặt & chạy (Local)](#8-cài-đặt--chạy-local)
9. [Kiểm thử](#9-kiểm-thử)
10. [Vận hành](#10-vận-hành)
11. [Hướng dẫn phát triển tiếp](#11-hướng-dẫn-phát-triển-tiếp)
12. [Hạn chế & khoảng trống hiện tại](#12-hạn-chế--khoảng-trống-hiện-tại)

---

## 1. Tổng quan project

### 1.1 Tên project

| Mục | Giá trị |
|-----|---------|
| **Tên package** | `ai-news` (`package.json`) |
| **Tên hiển thị** | **AI News Việt Nam** (`src/app/layout.tsx`, `.env.example`) |
| **Phiên bản** | `0.1.0` |

### 1.2 Mục đích chính

Hệ thống **tổng hợp tin tức AI tự động**: thu thập bài từ nhiều nguồn (RSS blog, Hacker News, Reddit, GitHub), chấm điểm mức độ quan trọng, phân loại trạng thái xuất bản, hiển thị trên web và (tùy chọn) gửi thông báo qua Telegram.

### 1.3 Bài toán giải quyết

- Giảm thời gian theo dõi thủ công nhiều nguồn AI (OpenAI, Anthropic, Reddit, HN, GitHub…).
- Lọc tin theo **điểm quan trọng** (rule-based scoring) thay vì hiển thị tất cả.
- Tập trung nội dung cho độc giả **tiếng Việt** (metadata/UI tiếng Việt; nội dung crawl chủ yếu tiếng Anh — xem [mục 12](#12-hạn-chế--khoảng-trống-hiện-tại)).

### 1.4 Đối tượng sử dụng

| Vai trò | Mô tả |
|---------|--------|
| **Độc giả công khai** | Xem danh sách bài đã xuất bản trên trang chủ |
| **Quản trị viên** | Duyệt/thống kê/cấu hình qua API admin (UI admin **chưa có** trong source) |
| **Vận hành (DevOps)** | Chạy crawl, cron, cấu hình Telegram, DB |

### 1.5 Chức năng chính

| # | Chức năng | Trạng thái trong code |
|---|-----------|------------------------|
| 1 | Crawl tin từ RSS, HN, Reddit, GitHub | ✅ Có (`src/crawlers/`) |
| 2 | Chấm điểm & phân loại bài (published/pending/rejected) | ✅ Có (`src/scoring/`) |
| 3 | Lưu trữ SQLite qua Prisma | ✅ Có |
| 4 | Trang chủ hiển thị bài published | ✅ Có (`src/app/page.tsx`) |
| 5 | REST API articles / admin / telegram | ✅ Có |
| 6 | Scheduler cron tự động | ⚠️ Có code, **chưa tự khởi động** |
| 7 | Trigger crawl qua API | ⚠️ **Mock**, chưa gọi crawler thật |
| 8 | Trang chi tiết bài `/articles/[slug]` | ❌ Chưa có page |
| 9 | Dashboard admin UI | ❌ Chưa có page |
| 10 | Dịch nội dung sang tiếng Việt bằng AI | ❌ Chưa có |

### 1.6 Module chính

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  Next.js App Router (page, layout, components)          │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    API Layer (Route Handlers)            │
│  /api/articles, /api/admin/*, /api/crawl, /api/telegram │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Business Logic                        │
│  Crawlers │ Scoring │ Scheduler │ Telegram │ Auth      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Data Layer                            │
│  Prisma ORM + SQLite (prisma/dev.db)                    │
└─────────────────────────────────────────────────────────┘
```

### 1.7 Mô hình hoạt động tổng thể

```mermaid
flowchart TB
    subgraph sources [Nguồn dữ liệu bên ngoài]
        RSS[RSS Feeds]
        HN[Hacker News API]
        RD[Reddit JSON API]
        GH[GitHub Search API]
    end

    subgraph crawl [Pipeline Crawl]
        C1[RSSCrawler]
        C2[HackerNewsCrawler]
        C3[RedditCrawler]
        C4[GitHubTrendingCrawler]
        SC[calculateScore]
        SAVE[Lưu Article vào DB]
    end

    subgraph app [Ứng dụng Next.js]
        HOME[Trang chủ /]
        API[REST API]
        TG[Telegram Bot API]
    end

    subgraph db [(SQLite prisma/dev.db)]
        SRC[Source]
        ART[Article]
        SET[AppSetting]
        RUN[CrawlRun]
    end

    RSS --> C1
    HN --> C2
    RD --> C3
    GH --> C4
    C1 & C2 & C3 & C4 --> SC --> SAVE --> ART
    SAVE -.->|chỉ lưu nếu sourceName khớp Source| SRC
    ART --> HOME
    ART --> API
    SC --> SET
    SAVE --> RUN
    ART --> TG
```

**Luồng chính:**

1. Crawler `fetch()` dữ liệu thô → chuẩn hóa thành `ArticleData`.
2. `calculateScore()` chấm 0–100, gán `status` theo ngưỡng trong `AppSetting`.
3. `saveToDatabase()` chỉ insert nếu `article.sourceName` **trùng tên** bản ghi trong bảng `Source`.
4. Trang chủ gọi `GET /api/articles?status=published` và render lưới bài viết.
5. Scheduler (nếu được kích hoạt) chạy `runAllCrawlers()`, gửi Telegram digest/tóm tắt ngày.

---

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ sử dụng | File/cấu hình liên quan | Vai trò trong hệ thống |
|------------|-------------------|-------------------------|-------------------------|
| Ngôn ngữ | **TypeScript 5** | `tsconfig.json`, `src/**/*.ts(x)` | Toàn bộ logic ứng dụng |
| Runtime | **Node.js** (≥20 khuyến nghị) | `package.json` | Chạy Next.js, Prisma, script |
| Frontend framework | **Next.js 16.2.6** (App Router) | `next.config.ts`, `src/app/` | SSR, routing, API routes |
| UI library | **React 19.2.4** | `src/app/`, `src/components/` | Component giao diện |
| CSS | **Tailwind CSS 4** | `postcss.config.mjs`, `src/app/globals.css` | Styling |
| Font | **Geist** (next/font/google) | `src/app/layout.tsx` | Typography |
| Backend | **Next.js Route Handlers** | `src/app/api/**/route.ts` | REST API (không có server Express riêng) |
| Database | **SQLite** | `prisma/schema.prisma`, `prisma/dev.db` | Lưu trữ persistent |
| ORM | **Prisma 7.8** | `prisma/`, `src/lib/prisma.ts` | Truy vấn DB, migration |
| DB driver adapter | **@prisma/adapter-better-sqlite3** + **better-sqlite3** | `src/lib/prisma.ts` | Prisma 7 yêu cầu driver adapter |
| RSS parsing | **rss-parser 3.13** | `src/crawlers/RSSCrawler.ts` | Parse feed RSS/XML |
| HTTP client | **fetch** (native), **axios** (dependency, ít/không dùng) | Crawlers, Telegram | Gọi API bên ngoài |
| Scheduling | **node-cron 4.2** | `src/lib/scheduler.ts` | Lên lịch crawl định kỳ |
| Auth (dự kiến) | Cookie `auth_token`, bcryptjs, JWT tự viết | `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/jwt.ts` | Bảo vệ route admin (chưa hoàn chỉnh) |
| Mã hóa cấu hình | **crypto-js** (AES) | `src/lib/crypto.ts`, `src/lib/settings.ts` | Giải mã setting nhạy cảm trong DB |
| Slug | **slugify** | `src/lib/utils.ts` | Tạo URL slug bài viết |
| ID | **cuid** (Prisma default), **uuid** (dependency) | `schema.prisma` | Primary key |
| Lint | **ESLint 9** + eslint-config-next | `eslint.config.mjs` | Kiểm tra code style |
| Package manager | **npm** | `package-lock.json` | Quản lý dependency |
| Build tool | **Next.js built-in** (Turbopack dev) | `npm run dev/build` | Build production |
| AI/LLM | **Chưa xác định rõ trong source code** | — | Không có tích hợp OpenAI/Claude để dịch hoặc tóm tắt |
| Realtime | **Không có** | — | Không dùng WebSocket/SSE |
| Queue/Cache | **Không có** | — | Không Redis, Bull, v.v. |
| Docker/Deploy | **Chưa xác định rõ trong source code** | — | Không có Dockerfile, docker-compose, PM2, Nginx config |
| Telegram | **Telegram Bot HTTP API** | `src/lib/telegram.ts` | Thông báo bài mới, lỗi crawl, tóm tắt ngày |

---

## 3. Cấu trúc thư mục

```bash
ai-news/
├── prisma/                          # Database schema, migration, seed
│   ├── schema.prisma              # Định nghĩa model Prisma (SQLite)
│   ├── seed.ts                    # Seed Source + AppSetting mặc định
│   ├── dev.db                     # File SQLite runtime (gitignored nếu tạo local)
│   └── migrations/
│       └── 20260515080813_init/   # Migration khởi tạo bảng
│           └── migration.sql
│
├── scripts/
│   └── crawl-direct.ts            # Script kiểm tra sourceName vs DB (không ghi DB)
│
├── public/                          # Static assets (icon SVG)
│   ├── vercel.svg
│   ├── file.svg
│   └── window.svg
│
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # Root layout (Navbar, metadata)
│   │   ├── page.tsx                 # Trang chủ — danh sách bài published
│   │   ├── globals.css              # Tailwind + CSS variables
│   │   └── api/                     # REST API endpoints
│   │       ├── articles/
│   │       │   ├── route.ts         # GET list articles
│   │       │   └── [...id]/route.ts # GET/PATCH chi tiết bài
│   │       ├── admin/
│   │       │   ├── login/route.ts   # POST đăng nhập admin
│   │       │   ├── settings/route.ts# GET/PUT cấu hình
│   │       │   └── stats/route.ts   # GET thống kê dashboard
│   │       ├── crawl/
│   │       │   └── trigger/route.ts # POST/GET crawl (hiện mock)
│   │       └── telegram/
│   │           ├── config/route.ts  # GET/PUT cấu hình Telegram
│   │           └── test/route.ts    # POST gửi tin test
│   │
│   ├── components/                  # React components dùng chung
│   │   ├── Navbar.tsx               # Navigation (Trang chủ, Quản trị)
│   │   ├── ArticleCard.tsx          # Card bài viết trên trang chủ
│   │   ├── Pagination.tsx           # Component phân trang (chưa dùng ở page)
│   │   └── StatusBadge.tsx          # Badge trạng thái (import nhưng chưa render)
│   │
│   ├── crawlers/                    # Crawler chính (class-based)
│   │   ├── BaseSourceCrawler.ts     # Abstract: fetch → score → save
│   │   ├── RSSCrawler.ts            # RSS blogs (rss-parser)
│   │   ├── HackerNewsCrawler.ts     # HN Firebase API
│   │   ├── RedditCrawler.ts         # Reddit hot.json
│   │   ├── GitHubTrendingCrawler.ts # GitHub search repos
│   │   └── index.ts                 # runAllCrawlers()
│   │
│   ├── scoring/
│   │   └── index.ts                 # Engine chấm điểm 0–100 (đang dùng)
│   │
│   ├── lib/                         # Thư viện nội bộ
│   │   ├── prisma.ts                # PrismaClient singleton (SQLite adapter)
│   │   ├── scheduler.ts             # Cron + runScheduler()
│   │   ├── telegram.ts              # Gửi Telegram, notify, daily summary
│   │   ├── settings.ts              # Đọc/ghi AppSetting
│   │   ├── crawlRun.ts              # start/finish CrawlRun
│   │   ├── auth.ts                  # bcrypt admin (chưa wired vào login)
│   │   ├── jwt.ts                   # JWT sign/verify (chưa wired)
│   │   ├── crypto.ts                # AES encrypt/decrypt
│   │   ├── utils.ts                 # slug, hash, format date
│   │   ├── scoring.ts               # ⚠️ Dead code — bản scoring cũ, không import
│   │   ├── crawlers/index.ts        # ⚠️ Dead code — crawler functional cũ
│   │   └── types.ts                 # Type phụ (legacy)
│   │
│   ├── types/
│   │   └── index.ts                 # ArticleData, AppSettings, AnalyticsStats
│   │
│   └── middleware.ts                # Bảo vệ /admin, security headers
│
├── .env.example                     # Mẫu biến môi trường
├── prisma.config.ts                 # Cấu hình Prisma CLI (DATABASE_URL, seed)
├── next.config.ts                   # Cấu hình Next.js
├── tsconfig.json                    # TypeScript (alias @/* → src/*)
├── postcss.config.mjs               # PostCSS + Tailwind
├── eslint.config.mjs                # ESLint
├── package.json                     # Dependencies & scripts
├── AGENTS.md / CLAUDE.md            # Quy tắc cho AI agent
└── .gitignore
```

### Giải thích nhanh từng nhóm

| Thư mục | Trách nhiệm |
|---------|-------------|
| `prisma/` | Schema DB, migration, seed dữ liệu nguồn & settings |
| `src/app/` | UI pages + API routes (full-stack trong Next.js) |
| `src/crawlers/` | Thu thập & chuẩn hóa dữ liệu từ nguồn bên ngoài |
| `src/scoring/` | Logic chấm điểm quan trọng bài viết |
| `src/lib/` | Hạ tầng: DB, Telegram, scheduler, crypto, auth |
| `src/components/` | UI tái sử dụng |
| `scripts/` | Script CLI hỗ trợ dev/debug |

---

## 4. Kiến trúc & luồng hoạt động

### 4.1 Crawler pipeline

Mỗi crawler kế thừa `BaseSourceCrawler`:

```
run()
  ├── startCrawlRun()           → tạo bản ghi CrawlRun
  ├── crawl()
  │     ├── fetch()             → lấy dữ liệu thô (abstract)
  │     └── validateAndScore()  → calculateScore() + gán status
  ├── saveToDatabase()
  │     ├── kiểm tra Source.name === article.sourceName
  │     ├── dedupe slug
  │     └── prisma.article.create()
  └── finishCrawlRun()          → cập nhật thống kê
```

**Ngưỡng xuất bản** (từ `AppSetting`, seed mặc định):

| Ngưỡng | Key | Mặc định | Hành vi |
|--------|-----|----------|---------|
| Xuất bản | `publish_threshold` | 75 | `status = published` |
| Chờ duyệt | `pending_threshold` | 60 | `status = pending` |
| Dưới ngưỡng | — | < 60 | `status = rejected` |

### 4.2 Mapping nguồn tin (Source)

Seed tạo 10 nguồn trong DB. Crawler gán `sourceName` phải **khớp chính xác** tên trong DB mới được lưu:

| Crawler | sourceName khi lưu | Khớp seed? |
|---------|-------------------|------------|
| RSS | `OpenAI Blog`, `Anthropic Blog`, `Google AI Blog`, `Meta AI Blog`, `DeepMind Blog` | ✅ |
| RSS (feed phụ) | `Vinta`, `Chip Huyen`, … | ❌ Bị skip |
| Reddit | `Reddit r/LocalLLaMA`, `Reddit r/MachineLearning`, `Reddit r/OpenAI` | ✅ (3 sub) |
| Reddit (sub khác) | `Reddit r/artificial`, … | ❌ Bị skip |
| Hacker News | `Hacker News` | ✅ |
| GitHub | `GitHub Trending` | ✅ |

### 4.3 Scoring engine (`src/scoring/index.ts`)

- Điểm cơ bản: **40**
- Cộng điểm: từ khóa lớn (GPT-5, Claude 4, Llama…), nguồn uy tín, category, tin mới (<48h), liên quan AI tiếng Việt
- Trừ điểm: tutorial, opinion, clickbait, quảng cáo, tin đồn
- Kết quả: **0–100**, kèm mảng `reasons` tiếng Việt

### 4.4 Scheduler (`src/lib/scheduler.ts`)

- `startScheduler(cron?)` — mặc định `0 0,6,12,18 * * *` (4 lần/ngày)
- `runScheduler()` → `runAllCrawlers()` → Telegram notify + daily summary
- **Lưu ý:** Không có `instrumentation.ts` hay lời gọi khi `next start` → cron **không tự chạy** trừ khi dev tự gọi.

### 4.5 Frontend

- **`/`** — Server Component fetch API nội bộ, hiển thị lưới `ArticleCard`, phân trang inline
- **`ArticleCard`** link tới `/articles/{slug}` — **page này chưa tồn tại**
- **`Navbar`** có link `/admin` — **page admin chưa tồn tại**

---

## 5. Mô hình dữ liệu

### 5.1 ERD tóm tắt

```
Source (1) ──< (N) Article     [logic: Article.sourceName khớp Source.name]
CrawlRun     — độc lập, log mỗi lần crawl
AppSetting   — key-value cấu hình hệ thống
TelegramLog  — log gửi Telegram theo articleId
```

### 5.2 Bảng chính

#### `Article`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | String (cuid) | PK |
| title, slug | String | Tiêu đề, URL slug (unique) |
| summaryVi, contentVi | String | Tóm tắt/nội dung (field tên Vi nhưng thường là EN từ nguồn) |
| sourceName, sourceUrl | String | Nguồn tin |
| originalUrl, originalTitle | String | Link & tiêu đề gốc |
| importanceScore | Int 0–100 | Điểm quan trọng |
| reasonForScore | String | Lý do chấm điểm |
| status | String | `draft` \| `pending` \| `published` \| `rejected` |
| category, tags | String | Phân loại, tags (tags lưu dạng chuỗi CSV) |
| contentHash | String | Hash dedupe |
| publishedAt | DateTime? | **Hiện không được set khi publish** |
| telegramSent | Boolean | Đã gửi Telegram chưa |

#### `Source`

| Cột | Mô tả |
|-----|-------|
| name (unique) | Tên nguồn — **phải khớp sourceName trên Article** |
| type | `rss`, `github`, `reddit`, `hackernews`, … |
| url | URL/API endpoint |
| enabled | Bật/tắt nguồn |

#### `AppSetting`

| Key (seed) | Mặc định | encrypted |
|------------|----------|-----------|
| publish_threshold | 75 | false |
| pending_threshold | 60 | false |
| cron_schedule | 0 6 * * * | false |
| admin_username | admin | false |
| admin_password_hashed | (rỗng) | true |
| telegram_bot_token | (rỗng) | true |
| telegram_chat_id | (rỗng) | true |
| encryption_key | (rỗng) | true |

---

## 6. API Reference

Base URL local: `http://localhost:3000`

### 6.1 Public — Articles

#### `GET /api/articles`

Query params:

| Param | Mặc định | Mô tả |
|-------|----------|-------|
| status | — | Lọc theo trạng thái |
| category | — | Lọc category |
| search | — | Tìm trong title, summaryVi, sourceName |
| sortBy | createdAt | `createdAt`, `importanceScore`, `publishedAt`, `title`, `sourceName` |
| sortOrder | desc | asc / desc |
| page | 1 | Trang |
| pageSize | 12 | Max 100 |

Response: `{ data: ArticleSummary[], pagination: {...} }`

#### `GET /api/articles/{slug|id}`

- Public chỉ xem bài `published`
- Admin view: `/api/articles/{slug}/admin` (theo logic route — chưa có auth trên PATCH)

#### `PATCH /api/articles/{slug|id}`

Body (optional fields): `status`, `summaryVi`, `contentVi`, `category`, `tags`, `importanceScore`, `reasonForScore`

> ⚠️ **Không có kiểm tra auth** trên endpoint này.

### 6.2 Admin (yêu cầu cookie `auth_token` qua middleware)

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/admin/login` | Đăng nhập — so `.env` ADMIN_* — trả token JSON (**không set cookie**) |
| GET | `/api/admin/settings` | Lấy toàn bộ AppSetting |
| PUT | `/api/admin/settings` | Upsert settings |
| GET | `/api/admin/stats` | Thống kê dashboard |

### 6.3 Crawl

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/crawl/trigger` | **Mock crawl** — không gọi crawler thật |
| GET | `/api/crawl/trigger` | 20 CrawlRun gần nhất |

### 6.4 Telegram

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/telegram/config` | Trạng thái cấu hình (token masked) |
| PUT | `/api/telegram/config` | Cập nhật bot token & chat id vào DB |
| POST | `/api/telegram/test` | Gửi tin nhắn test |

---

## 7. Cấu hình môi trường

Sao chép `.env.example` → `.env`:

| Biến | Bắt buộc (local) | Mô tả |
|------|------------------|-------|
| `DATABASE_URL` | ✅ (cho Prisma CLI) | `file:./dev.db` |
| `APP_BASE_URL` | Khuyến nghị | URL app — trang chủ dùng để gọi API |
| `ADMIN_USERNAME` | Khuyến nghị | Login admin API |
| `ADMIN_PASSWORD` | Khuyến nghị | Login admin API |
| `ENCRYPTION_KEY` | Khuyến nghị | AES cho setting encrypted |
| `GITHUB_TOKEN` | Không | **Chưa được code đọc** — tránh rate limit GitHub nếu tích hợp sau |
| `CRON_SCHEDULE` | Không | **Chưa được code đọc** — scheduler dùng hardcode hoặc AppSetting |
| `TELEGRAM_*` | Không | Telegram đọc từ **DB AppSetting**, không từ env runtime |

> **Quan trọng:** Runtime app (`src/lib/prisma.ts`) **hardcode** đường dẫn `prisma/dev.db`, không đọc `DATABASE_URL`. Migration/seed cần tạo DB cùng vị trí đó.

---

## 8. Cài đặt & chạy (Local)

### 8.1 Yêu cầu

- Node.js ≥ 20
- npm

### 8.2 Các bước

```bash
# 1. Clone & cài dependency
cd ai-news
npm install

# 2. Tạo .env
cp .env.example .env
# Windows: copy .env.example .env
# Chỉnh APP_BASE_URL, ADMIN_*, ENCRYPTION_KEY nếu cần

# 3. Migration database
npx prisma migrate dev

# 4. Seed dữ liệu mặc định
npx prisma db seed
# hoặc: npx tsx prisma/seed.ts

# 5. Generate Prisma Client (nếu chưa)
npx prisma generate

# 6. Chạy dev server
npm run dev
```

Truy cập: **http://localhost:3000**

### 8.3 Chạy crawl thật (ngoài API mock)

Hiện chưa có lệnh npm chính thức. Có thể:

```bash
# Kiểm tra mapping sourceName (không ghi DB)
npx tsx scripts/crawl-direct.ts

# Hoặc tạo script tạm gọi runAllCrawlers() từ src/crawlers/index.ts
```

### 8.4 Build production

```bash
npm run build
npm run start
```

### 8.5 Scripts npm

| Script | Lệnh | Mô tả |
|--------|------|-------|
| dev | `npm run dev` | Next.js development server |
| build | `npm run build` | Build production |
| start | `npm run start` | Chạy production server |
| lint | `npm run lint` | ESLint |

---

## 9. Kiểm thử

### 9.1 Kiểm thử tự động

**Chưa xác định rõ trong source code** — không có Jest, Vitest, Playwright, hay test file.

### 9.2 Kiểm thử thủ công đề xuất

| # | Kịch bản | Cách kiểm tra | Kết quả mong đợi |
|---|----------|---------------|------------------|
| 1 | Seed DB | `npx prisma db seed` | 10 Source + 8 AppSetting |
| 2 | Trang chủ | Mở `/` | Hiển thị lưới bài hoặc empty state |
| 3 | API list | `GET /api/articles?status=published` | JSON + pagination |
| 4 | Crawl mapping | `npx tsx scripts/crawl-direct.ts` | Log ✅/❌ sourceName |
| 5 | Admin login | `POST /api/admin/login` body `{username,password}` | 200 + token |
| 6 | Admin stats | `GET /api/admin/stats` (cần cookie) | Thống kê JSON |
| 7 | Telegram test | Cấu hình token/chat id → `POST /api/telegram/test` | Tin nhắn Telegram |
| 8 | Lint | `npm run lint` | Không lỗi ESLint |

---

## 10. Vận hành

### 10.1 Deploy

**Chưa xác định rõ trong source code.** Không có Dockerfile, CI/CD, hay hướng dẫn deploy.

Gợi ý triển khai phù hợp kiến trúc hiện tại:

| Môi trường | Ghi chú |
|------------|---------|
| **VPS + PM2** | `npm run build && pm2 start npm -- start` — cần cron riêng cho scheduler |
| **Docker** | Cần viết Dockerfile; mount volume cho `prisma/dev.db` |
| **Vercel** | ⚠️ SQLite + cron + long-running crawl **không phù hợp** serverless |

### 10.2 Cron / Scheduler

- Code: `src/lib/scheduler.ts`
- Cần gọi `startScheduler()` khi process khởi động (ví dụ `instrumentation.ts` hoặc cron OS)
- Hoặc dùng **system cron** gọi script crawl định kỳ

### 10.3 Backup

- Backup file **`prisma/dev.db`** định kỳ (SQLite single file)
- Backup `.env` (không commit git)

### 10.4 Monitoring

- Log console từ crawlers (`[RSS]`, `[Reddit]`, `[Scheduler]`)
- Bảng `CrawlRun`, `TelegramLog` trong DB
- API `GET /api/admin/stats` cho dashboard

### 10.5 Bảo mật vận hành

- Đổi `ADMIN_PASSWORD`, `ENCRYPTION_KEY` mặc định
- Không expose `/api/admin/*` ra internet nếu chưa hoàn thiện auth
- Telegram token lưu trong DB — bảo vệ file DB và backup

---

## 11. Hướng dẫn phát triển tiếp

### 11.1 Ưu tiên cao (để MVP chạy end-to-end)

1. **Nối `/api/crawl/trigger` → `runAllCrawlers()`**
2. **Tạo page `/articles/[slug]`** — đọc API chi tiết bài
3. **Tạo `/admin/login` + `/admin` dashboard** — dùng API stats/settings có sẵn
4. **Thống nhất auth** — login set cookie `auth_token`, dùng `jwt.ts`, bảo vệ PATCH articles
5. **Set `publishedAt`** khi `status = published`
6. **Khởi động scheduler** qua `instrumentation.ts`

### 11.2 Thêm nguồn tin mới

1. Thêm bản ghi vào `prisma/seed.ts` (hoặc DB) với `name` unique
2. Trong crawler tương ứng, map `sourceName` **đúng tên** trong DB
3. Chạy lại seed / insert Source

### 11.3 Thêm crawler mới

1. Tạo class extends `BaseSourceCrawler`
2. Implement `fetch()` → trả về `ArticleData[]`
3. Đăng ký trong `src/crawlers/index.ts` → `runAllCrawlers()`

### 11.4 Alias import

TypeScript alias: `@/*` → `src/*` (cấu hình trong `tsconfig.json`)

### 11.5 Scripts npm đề xuất bổ sung

```json
{
  "db:seed": "tsx prisma/seed.ts",
  "db:migrate": "prisma migrate dev",
  "crawl": "tsx scripts/run-crawl.ts"
}
```

---

## 12. Hạn chế & khoảng trống hiện tại

| # | Vấn đề | Mức độ |
|---|--------|--------|
| 1 | API crawl trigger chỉ mock | Cao |
| 2 | Không có trang chi tiết bài, admin UI | Cao |
| 3 | Auth admin chưa thống nhất (cookie vs JSON token) | Cao |
| 4 | Scheduler không tự khởi động | Trung bình |
| 5 | `publishedAt` không được set khi publish → Telegram digest có thể bỏ sót | Trung bình |
| 6 | Dead code: `src/lib/scoring.ts`, `src/lib/crawlers/` | Thấp |
| 7 | Admin stats `scoreDistribution` dùng range 0–10 trong khi score thực 0–100 | Bug |
| 8 | Không có test tự động | Trung bình |
| 9 | Không có Docker/CI/CD | Trung bình |
| 10 | Không có bước dịch AI sang tiếng Việt | Theo thiết kế hiện tại |

---

## License

Private project.
