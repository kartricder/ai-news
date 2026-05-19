# Handover Phase 3

## Hoan thanh

- Them AI Intelligence pipeline tai `src/lib/pipeline/crawlPipeline.ts`.
- Moi lan crawl gom candidate tu RSS, Hacker News, Reddit, GitHub, dedupe, rank, chi xu ly AI va publish toi da `MAX_PUBLISH_PER_CRAWL`.
- Them OpenRouter client tai `src/lib/ai/openRouter.ts` voi model chinh `openrouter/auto` va 2 fallback model.
- Luu ket qua AI vao Article: `titleVi`, `briefVi`, `whyImportant`, `aiTags`, `targetAudience`, `impactLevel`, `aiProvider`, `aiModel`, `aiStatus`, `aiError`, `aiProcessedAt`.
- Them dedupe metadata: `canonicalUrl`, `duplicateOfId`, `duplicateReason`.
- Telegram gui tung bai published qua `sendPublishedArticleTelegram`; loi Telegram khong rollback article.
- Them CLI cron `scripts/cron-crawl.ts` va npm script `cron:crawl`.
- Them HTTP cron endpoint `GET/POST /api/cron/crawl` bao ve bang `CRON_SECRET`.
- Them Repo Radar pipeline tai `src/lib/pipeline/repoRadar.ts`, model `RepoRadarItem`, public section tren trang chu va admin page `/admin/repo-radar`.
- Them API admin:
  - `GET /api/admin/crawl-runs`
  - `GET /api/admin/repo-radar`
  - `PATCH /api/admin/repo-radar/:id`
  - `POST /api/admin/repo-radar/:id/publish`
  - `POST /api/admin/test-ai-translation`

## Database

Migration moi:

- `prisma/migrations/20260519080000_phase3_ai_repo_radar/migration.sql`

Model/field moi:

- Article AI fields, duplicate fields, canonical URL.
- CrawlRun counters: candidates, duplicates, AI success/failed, Telegram sent, Repo Radar found.
- RepoRadarItem table.

Da chay local:

```bash
npx prisma generate
npx prisma migrate deploy
```

## Env moi

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_FALLBACK_MODEL=google/gemini-2.5-flash
OPENROUTER_SECOND_FALLBACK_MODEL=mistralai/mistral-small-3.2-24b-instruct
AI_TRANSLATION_ENABLED=true
AI_IMPORTANCE_REASON_ENABLED=true
ALLOW_PUBLISH_WITHOUT_AI=false
MAX_PUBLISH_PER_CRAWL=10
MIN_SCORE_TO_PUBLISH=75
MAX_REPO_RADAR_AI_PER_CRAWL=10
CRON_SECRET=
```

## Cach test

```bash
npm run lint
npm run build
npx prisma migrate deploy
npx prisma db seed
npm run cron:crawl
```

HTTP cron:

```bash
curl -i -X POST http://localhost:3000/api/cron/crawl
curl -X POST "http://localhost:3000/api/cron/crawl?secret=$CRON_SECRET"
```

Ky vong:

- Thieu secret tra 401.
- Dung secret tra JSON stats.
- So bai publish trong mot run khong vuot `MAX_PUBLISH_PER_CRAWL`.
- AI loi thi article pending voi `aiStatus=failed`, crawler khong crash.
- Repo Radar co item va `repoScore`.

## Luu y van hanh

- `OPENROUTER_API_KEY` chi doc server-side, khong tra ve frontend.
- Neu deploy Docker voi SQLite mount tu host, dam bao container user ghi duoc `prisma/dev.db`.
- Neu dung HTTP qua IP trong production, can `FORCE_HTTP=true` de cookie admin hoat dong.
- Cron VPS nen dung `npm run cron:crawl` thay vi endpoint HTTP neu server cung may voi app.

## De xuat Phase sau

- Them retry Telegram cho article `telegramSent=false`.
- Them relatedSources de gom nhieu nguon cung mot tin thay vi chi skip duplicate.
- Them UI edit AI fields trong admin articles.
- Them metrics chi tiet theo source/model trong CrawlRun hoac table rieng.
