# AI News Việt Nam

MVP tổng hợp tin tức AI bằng Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Prisma 7 và SQLite. Luồng chính: crawl nguồn RSS/Hacker News/Reddit/GitHub, chấm điểm 0-100, chống trùng, lưu DB, auto publish theo threshold, hiển thị public và quản trị qua admin.

## Chạy local

1. Cài dependency:

```bash
npm ci
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
- `AI_TRANSLATION_ENABLED`, `AI_IMPORTANCE_REASON_ENABLED`: hai chức năng độc lập; cả hai tắt thì không gọi provider.
- `AI_PROCESSING_ENABLED=false`, `AI_AUTO_PUBLISH_ENABLED=false`: mặc định không xử lý trả phí hoặc tự xuất bản. Cần người vận hành bật riêng sau nghiệm thu.
- `AI_DAILY_BUDGET_USD=0`, `AI_MAX_INPUT_TOKENS=0`, `AI_MAX_OUTPUT_TOKENS=0`, `AI_PRICING_JSON={}`: thiếu budget/giới hạn/bảng giá hợp lệ thì fail closed. Không có giá model hardcode.
- `ALLOW_PUBLISH_WITHOUT_AI=false`: chỉ bỏ yêu cầu dịch với bản gốc tiếng Việt phù hợp khi không dùng dịch AI; không vượt evidence/date/quality gate hoặc lỗi của phần AI đã gọi.
- `PENDING_PROCESSING_ENABLED=false`, `PENDING_CRON_SCHEDULE="*/15 * * * *"`, `PENDING_PROCESS_LIMIT=10`: lịch backlog UTC, tách khỏi lịch crawl.
- `CRON_SECRET`: secret cho endpoint HTTP cron `/api/cron/crawl`.

3. Migration và seed trên DB mới/DB tạm trước. Không chạy bản Prisma client mới trên DB schema cũ. Với dữ liệu hiện có, cần snapshot/collision report T1 và phê duyệt migration riêng trước khi thay DB đang dùng:

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
- `npm run process:pending -- --dry-run --limit 10`: đọc DB đã migrate bằng SQLite readonly, chỉ lựa chọn/ước lượng; không gọi model, ghi DB, tạo lease/reservation hay gửi Telegram. Chưa cấu hình giá thì ước lượng là unknown, không phải 0.
- `npm run process:pending -- --limit 10`: xử lý backlog thật, dùng budget/gate cấu hình; đây không phải dry-run.
- `npm run cron:pending`: tick đọc enable/schedule/limit từ settings rồi mới xử lý nếu đến hạn; disabled mặc định.
- `npm run sources:import -- --dry-run`: preview catalog readonly, không ghi đè nguồn.
- `npm run sources:probe -- --catalog-id <id> --dry-run`: gọi mạng để probe nhưng không ghi DB/AI; chỉ chạy khi được phép kiểm tra nguồn.
- `npm run test:news`: regression offline, migration/seed trên DB tạm, provider mock; không chứng minh chất lượng bản dịch live.
- `npm run evaluate:news -- --mode offline --write-reports`: benchmark 120 case synthetic/provisional, split 80/40 cố định và baseline Git được pin; không mạng, AI trả phí, Telegram hoặc ghi DB. Exit 1 là lỗi harness/regression, exit 2 là chưa đạt cổng chất lượng/rollout, không được coi là pass.
- `npm run check:build:news`: production webpack build trong sandbox cùng ổ, sao chép source chọn lọc không `.env`, dependency dùng liên kết (Geist copy nguyên trạng), migration chỉ DB tạm và cleanup. Không kiểm chứng Turbopack/Docker/HTTP.

## Đánh giá chất lượng T9

Báo cáo chi tiết: [baseline](docs/reports/news-quality-baseline.md), [after](docs/reports/news-quality-after.md), [kết quả từng case](docs/reports/news-quality-results.json). Fixture synthetic chỉ là regression với nhãn AI provisional, không phải tin thật hoặc gold do biên tập viên duyệt. Giữ nguyên fixture/hash v1 và không tune theo holdout đã xem.

Lần đo 2026-10-30: holdout mới precision 10/10 (100%), recall 10/16 (62,5%, chưa đạt 85%), dedupe FP 0/5 cặp khác bài, cluster precision 4/4 gợi ý. Holdout tiếng Việt chỉ có negative, chưa có bằng chứng recall tiếng Việt. Chưa đủ điều kiện rollout: chưa có >=100 output AI live, >=30 bản tin được người duyệt, 3 shadow crawl hoặc kiểm chứng nguồn live. Test 23/23, lint/typecheck và sandbox webpack build pass không thay thế các cổng này.

## Docker optional

Repo có `Dockerfile` và `docker-compose.yml` tối thiểu để chạy sandbox/container. Với VPS thật, tài liệu `DEPLOY_VPS.md` khuyến nghị PM2 + Nginx + system cron để vận hành SQLite rõ ràng hơn.

Build context giữ lockfile và dùng `npm ci`; runner có source, scripts, tsconfig và Prisma config để CLI dùng cùng resolver DB. DB phục vụ build nằm ở `/tmp/ai-news-build.db`, không được copy vào runner hoặc thay DB mounted. Build không mang `.env` thật. Entrypoint không tự migrate/seed và không dùng chmod world-writable; custom DB directory phải được người vận hành cấp quyền. CLI/container acceptance chưa được chạy cho thay đổi T1–T8.

## Admin

Đăng nhập tại `/admin/login` bằng `ADMIN_USERNAME`/`ADMIN_PASSWORD`. Login set cookie `auth_token` dạng httpOnly, sameSite lax, secure khi production.

Các màn hình chính:

- `/admin`: dashboard tổng số bài, trạng thái nguồn, Telegram, crawl gần nhất.
- `/admin/articles`: original/AI cạnh nhau, evidence/claims/score, queue/retry, 20 attempt và 10 audit gần nhất; approve/reject/edit/reprocess giữ slug. Ngoại lệ evidence/quality cần xác nhận và lý do được audit; reprocess chỉ enqueue, không gọi AI trong request.
- `/admin/sources`: publisher/kind/language, 304/error/stale, probe và enabled. Nguồn mới disabled/unverified; sửa URL/config buộc probe lại trước enable.
- `/admin/settings`: threshold, cờ AI, budget USD/ngày UTC, giá/token và lịch pending. DB AppSetting có ưu tiên hơn biến môi trường.
- `/admin/analytics`: known spend, reserved unknown/unsettled, lỗi source/model, backlog age và coverage theo nhóm nguồn.
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
- `POST /api/admin/articles/{id}/reprocess`: admin only, bắt buộc reviewReason; force=true mới bỏ cache. Bài published hoặc identity/content chưa giải quyết bị từ chối.
- `GET/POST /api/cron/crawl`: cron endpoint, bắt buộc `CRON_SECRET` qua query `?secret=` hoặc header `x-cron-secret`.

## AI Intelligence pipeline

Pipeline tạo `CrawlRun`, đọc các source enabled qua adapter chung (RSS/HN/Reddit/GitHub discovery/arXiv/Releases), normalize/evidence/score/exact-dedupe, rồi lưu tất cả bài mới pending trước AI. Candidate ngoài quota vẫn ở backlog. Validator HTTP chỉ checkpoint sau persistence.

Worker quét backlog đến hạn, xếp hạng theo clock hiện tại; chọn tối đa 10 bài, 2/publisher và 3 community. Trạng thái nội dung tách khỏi processingStatus. Claim có điều kiện, lease bài 5 phút và batch lease được gia hạn; network không nằm trong transaction. Cache gắn articleId/inputHash/promptVersion/schemaVersion, có cả cờ dịch/reason trong hash. Input đổi, admin edit hoặc mất lease thì không ghi kết quả cũ. Published không tự bị sửa/unpublish khi đổi scorer hay quan sát source thay đổi.

AI dùng JSON mode và runtime validation trong từng attempt: title 90, brief 450, whyImportant 800 ký tự, enum/claims/evidence IDs có kiểm tra. Không giả định model hỗ trợ JSON Schema. Tối đa 3 model/6 calls, 30s/call và deadline 120s/bài, backoff 2s/4s+jitter, Retry-After quá deadline được lưu lại. 401/402/403 dừng cấu hình/quyền; refusal/moderation không được vòng qua fallback. Quality heuristic gắn review cho số/model/URL/rumor/uncertainty không đủ căn cứ. Evidence ID không chứng minh claim đúng; vẫn cần biên tập viên và đánh giá T9.

Mỗi model ID cụ thể phải có entry trong AI_PRICING_JSON: inputUsdPerMillion, outputUsdPerMillion (số USD trên một triệu token, không âm), verifiedAt (ngày ISO người vận hành đã kiểm chứng). Không dùng `openrouter/auto` hoặc `:free` trong bảng giá vì không có giá cố định đáng tin. Ba model trong settings được dedupe và chỉ model có giá hợp lệ mới được gọi. Bảng giá do người vận hành xác minh với endpoint/provider thực tế; không có live pricing verification tự động. Guard đầu vào dùng số byte UTF-8 cộng overhead làm ước lượng token bảo thủ; output bị chặn bởi max_tokens.

Trước MỖI call, reserve atomic bằng integer micro-USD vào ngày UTC; cost provider được ưu tiên, nếu không có thì tính từ usage và bảng giá đã xác minh cho đúng model thực trả. Thiếu cả cost/usage thì unknown, GIỮ reservation; crash/reservation chưa settle cũng không hoàn tiền mù quáng. Known spend và reserved cùng tính vào trần; provider có thể báo chi phí cao hơn estimate nếu bảng giá sai, khi đó ngừng các attempt tiếp theo. Bài và Repo Radar có trần 10 item riêng nhưng dùng chung budget tổng. Không hứa exactly-once cho provider/Telegram: crash sau gửi có thể gây generation lặp khi lease được thu hồi; reservation cũ tiếp tục giữ và hạn chế chi phí.

Lỗi tạm có delay 5m, 30m, 2h theo số chu kỳ, tối đa 3 chu kỳ AI (vì vậy lỗi ở chu kỳ 3 là terminal, không tự có chu kỳ 4). Budget chờ lịch phù hợp, không tiêu chu kỳ generation khi chưa gọi; cấu hình/evidence/schema/refusal chờ admin sửa/reprocess, không retry nóng. Cache hỏng yêu cầu review. Auto-publish chỉ khi cờ riêng bật, đủ nguồn/ngày/điểm/evidence và không còn review flags, tối đa min(10, max_publish_per_crawl). Ready khi auto-publish tắt không bị gọi AI lặp. Preview AI admin yêu cầu confirmPaidRequest=true và evidence thật, cùng budget/audit; không có bài mẫu ngầm định.

## Cron

Ưu tiên system cron trên VPS:

```cron
0 6 * * * cd /path/to/ai-news && npm run cron:crawl >> logs/cron-crawl.log 2>&1
* * * * * cd /path/to/ai-news && npm run cron:pending >> logs/cron-pending.log 2>&1
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

Pending tick mỗi phút đọc lịch UTC trong DB; checkpoint kỳ chạy có điều kiện để nhiều tick không cùng kích hoạt một kỳ. Lần đầu sau khi bật có thể xử lý ngay; đổi expression sẽ hẹn kỳ tiếp theo. App scheduler cũng gọi cùng tick nếu người vận hành chủ động startScheduler; phiên triển khai không tự khởi chạy scheduler. Không cần chạy cả app scheduler và system cron. CLI process:pending là lệnh trực tiếp có chủ đích, không phụ thuộc cờ pending cron; vẫn chịu cờ AI/budget/auto-publish. Rate limiting nguồn HTTP vẫn process-local, không chạy nhiều crawler/probe arXiv trên nhiều process/máy đồng thời.

## Crawler và dedupe

Crawler đọc source bật trong DB. Catalog/import/seed không ghi đè enabled/URL/config/settings đang có; nguồn mới disabled/unverified. T9 đã kiểm tra migration/seed lặp trên DB tạm absolute/relative, giữ override/setting/slug; chưa migration/seed DB thật.

Identity dùng canonical URL BÀI, fallback cặp sourceId/externalId, không dùng feed URL hoặc title similarity. Fingerprint SHA-256 nội dung gốc dùng phát hiện thay đổi, không dùng làm khóa loại bài khác URL. Bài trùng được giữ liên kết, không xóa; cùng identity đổi nội dung chỉ gắn review/pendingFingerprint. Cluster chỉ là suggestion, không merge tự động.

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

- T1–T8 vẫn chưa được nghiệm thu toàn phần. T9 bổ sung regression offline/DB tạm và sandbox webpack build; không migrate DB thật, chưa kiểm tra nguồn/AI live, browser/HTTP/Docker hoặc đủ cổng rollout. Xem kế hoạch và nhật ký trước khi vận hành.

- `better-sqlite3` báo `NODE_MODULE_VERSION`: chạy `npm rebuild better-sqlite3`.
- Build báo lock `.next`: dừng `next dev`, xóa `.next`, build lại.
- Admin login fail ở production: kiểm tra `ADMIN_PASSWORD` không để mặc định/empty.
- Telegram test fail: kiểm tra bot token, chat id và bot đã có quyền gửi vào chat.
- RSS 404: sửa URL source trong `/admin/sources`.
