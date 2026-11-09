# Nâng cấp chất lượng tin, AI và mở rộng nguồn — Implementation Plan

> **For agentic workers:** Thực thi từng nhiệm vụ bằng `superpowers:executing-plans` nếu skill khả dụng. Chỉ dùng subagent khi phiên thực thi cho phép. Các checkbox là trạng thái bàn giao, không phải tuyên bố tính năng đã tồn tại.

**Goal:** Tăng độ phủ tin AI có giá trị, giảm bỏ sót/trùng tin, tạo bản tin tiếng Việt có căn cứ và kiểm soát được chất lượng, độ mới, chi phí AI.

**Architecture:** Giữ Next.js + Prisma + SQLite và OpenRouter. Chuẩn hóa nguồn → thu thập có bằng chứng → chống trùng → chấm điểm → hàng chờ AI lưu trong DB → kiểm tra chất lượng → xuất bản. Dùng chung pipeline cho CLI và API; không xây microservice hoặc đổi database trong phạm vi này.

**Tech Stack:** TypeScript, Next.js 16.2.6, React 19, Prisma 7, better-sqlite3, rss-parser, OpenRouter. Phiên thực thi phải kiểm tra phiên bản thực tế trong lockfile.

**Spec:** Yêu cầu người dùng ngày 2026-10-30: viết một file Markdown cụ thể để AI các phiên sau thực thi, tập trung chất lượng tin, AI và tăng nguồn tin. File này chứa cả đặc tả và kế hoạch thực thi; không phụ thuộc lịch sử chat.

**Trạng thái:** T0 đã kiểm chứng offline ngày 2026-10-30. T1–T5 đã triển khai mã, chưa nghiệm thu hành vi/migration do người dùng yêu cầu bỏ qua test. T3 chưa nghiệm thu nguồn live; T6–T9 chưa triển khai. Checkbox mã bên dưới không phải bằng chứng test hoặc migration đã chạy. Các ngưỡng là cấu hình khởi điểm cần đánh giá, không phải kết quả đo đã đạt. Baseline và giới hạn kiểm chứng nằm trong nhật ký mục 19.

## 1. Cách tiếp tục ở phiên mới

1. Đọc toàn bộ file này và `AGENTS.md`; đọc `git status --short` để bảo toàn thay đổi đang có.
2. Đọc mã nguồn hiện hành tại các đường dẫn mục 3, đối chiếu vì dự án có thể đã thay đổi.
3. Chọn task đầu tiên chưa hoàn thành và đủ dependency. Mỗi phiên hoàn thành một phần có thể kiểm chứng; không đánh dấu hoàn thành khi chỉ viết code.
4. Trước khi sửa Next.js, đọc hướng dẫn liên quan trong `node_modules/next/dist/docs/` theo `AGENTS.md`. Nếu chưa có dependency, khôi phục bằng lockfile; không suy đoán API framework.
5. Với logic xử lý tin: thêm test hồi quy thất bại đúng nguyên nhân → triển khai → chạy test → kiểm tra tích hợp. Không cần test chỉ để kiểm tra sự tồn tại của file/config.
6. Cập nhật bảng tiến độ và nhật ký cuối file: thay đổi, lệnh kiểm tra, kết quả, phần chưa kiểm chứng và việc tiếp theo.
7. Không tự triển khai production, gọi AI hàng loạt hoặc gửi Telegram thật. Test mặc định dùng fixture, DB tạm và AI giả lập. Việc chạy thật phải có giới hạn chi phí và cấu hình rõ ràng.

## 2. Phạm vi và ràng buộc

### Trong phạm vi

- Sửa các lỗi đang làm thiếu tin, sai phân loại và AI không được thử lại.
- Danh mục nguồn cấu hình được; kiểm chứng endpoint; thêm nguồn chính thức, nghiên cứu, kỹ thuật, báo chí và Việt Nam.
- Chuẩn hóa nội dung gốc, độ mới, nguồn dẫn, mức đủ dữ kiện.
- Chấm điểm giải thích được; chống trùng chính xác trước, gom sự kiện sau.
- AI có schema, phiên bản prompt, retry, trạng thái chờ duyệt, theo dõi usage và ngân sách.
- Admin phục vụ kiểm tra nguồn, biên tập và đánh giá chất lượng.
- Test, benchmark, tài liệu vận hành và kiểm tra CLI trong Docker phục vụ các phần trên.

### Ngoài phạm vi

- Tài khoản độc giả, thanh toán, quảng cáo, redesign toàn bộ UI, chatbot/RAG.
- PostgreSQL, Redis, vector database, Kubernetes hoặc worker platform mới.
- Dịch toàn văn hàng loạt; sao chép nội dung sau paywall; crawler vượt CAPTCHA hoặc cơ chế chặn truy cập.
- Tự động xuất bản thông tin chỉ có tiêu đề hoặc tin đồn chưa đủ căn cứ.

### Ràng buộc dữ liệu

- Không reset/xóa database hiện có. Migration theo hướng thêm trường/bảng, có kiểm tra bản sao và khả năng khôi phục.
- Giữ URL/slug bài đã xuất bản. Không đổi tên nguồn làm mất liên kết với bài cũ.
- Không tự bật nguồn admin đã tắt, không ghi đè URL/config admin chỉnh khi import danh mục.
- Giữ API public tương thích; bổ sung field theo hướng additive. Trace, prompt, raw content, lỗi nhà cung cấp và chi phí chỉ dành cho admin.
- Dùng thời gian UTC trong DB, hiển thị Asia/Ho_Chi_Minh; test thời gian dùng clock cố định.

## 3. Bản đồ mã nguồn và vấn đề đã quan sát

| File hiện có | Vai trò / điểm cần chú ý |
|---|---|
| `src/lib/pipeline/crawlPipeline.ts` | Pipeline chính; `findDuplicate` so cả URL feed; pending chưa có hàng chờ retry độc lập; AI chỉ chạy khi cả hai cờ AI đều true |
| `src/crawlers/BaseSourceCrawler.ts` | Chấm điểm qua `@/scoring`; còn luồng lưu cũ; lỗi nguồn giữ trong `sourceErrors` nhưng `crawl()` chỉ trả articles |
| `src/crawlers/RSSCrawler.ts` | RSS từ DB; `sourceUrl` là URL feed; lấy snippet 300 ký tự; có RSS/Atom qua rss-parser |
| `src/crawlers/HackerNewsCrawler.ts` | Chỉ lấy 30 top stories; regex `ai` quá rộng; endpoint hardcode, không dùng URL nguồn trong DB |
| `src/crawlers/RedditCrawler.ts` | Danh sách subreddit hardcode; thêm nguồn DB chưa chắc được crawl; summary đang lặp tiêu đề |
| `src/crawlers/GitHubTrendingCrawler.ts` | Repo mới 7 ngày; fallback dùng mốc ngày cố định; không phải dữ liệu trang GitHub Trending |
| `src/lib/pipeline/repoRadar.ts` | Repo discovery khác luồng GitHub crawler; chỉ dùng 8 topic đầu; cần tránh gọi AI lặp giữa hai luồng |
| `src/lib/ai/openRouter.ts` | Retry 2 lần/model, tối đa 3 model, 45s/call; kiểm tra trường bắt buộc nằm ngoài fallback; chưa lưu usage |
| `src/scoring/index.ts` | Điểm dựa nhiều vào tên phiên bản model; regex penalty có cờ global và `.test()` mang trạng thái |
| `src/lib/utils.ts` | Hash 32-bit; canonical URL; so từ tiêu đề; không nên dùng title đã dịch để so với title gốc |
| `src/lib/settings.ts`, `src/types/index.ts` | Cấu hình hệ thống và kiểu dữ liệu; settings đang được đọc nhiều lần mỗi lượt |
| `src/lib/prisma.ts`, `prisma.config.ts`, `prisma/seed.ts` | Runtime hardcode đường dẫn DB; CLI dùng env; seed nguồn có thể ghi đè URL/type/config |
| `src/lib/crawlers/index.ts`, `src/lib/scoring.ts` | Các implementation khác; xác định import/caller trước khi hợp nhất, không xóa chỉ vì nhìn trùng |
| `src/app/api/admin/sources/**`, `src/app/admin/sources/page.tsx` | Quản trị nguồn hiện có |
| `src/app/api/articles/**`, `src/app/admin/articles/page.tsx` | API bài và biên tập; giữ auth guard và chỉ public bài published |
| `Dockerfile`, `.dockerignore` | Runtime chưa copy đủ source/config cho CLI; lockfile bị loại khỏi build context |

Các nhận xét trên từ đọc code ngày 2026-10-30, chưa phải kết quả test runtime. Phiên trước đã build Docker và API đọc bài trả 200; chưa xác nhận crawler/seed trong image. Lần kiểm tra lint gần nhất không chạy được do thiếu executable `eslint`; không ghi nhận là lint pass.

## 4. Review Focus

1. Nhiều bài mới cùng feed và cùng tiêu đề nhưng khác phiên bản model: không mất bài hợp lệ (T1, T5).
2. Feed trả HTML/403/429, redirect vào mạng nội bộ, timestamp sai hoặc thiếu: có trạng thái rõ, không coi là thành công rỗng (T2, T3).
3. Nội dung nguồn chứa chỉ dẫn giả mạo, chỉ có tiêu đề, hoặc tuyên bố benchmark thiếu điều kiện: không tự xuất bản lời khẳng định thiếu căn cứ (T4, T6).
4. Hai lượt crawl chạy chồng hoặc tiến trình chết sau gọi AI: không xuất bản/tiêu tiền lặp không giới hạn (T7).
5. Seed/migration chạy lại trên dữ liệu đã được admin chỉnh: không mất cấu hình, bài hay slug (T0, T2, T8).

## 5. Hợp đồng dữ liệu và module mục tiêu

Tạo các file dưới đây ở task sở hữu; không tạo khung rỗng cho tất cả ngay từ đầu.

| Module mới | Trách nhiệm |
|---|---|
| `src/lib/news/types.ts` | Kiểu dùng chung dưới đây và category chuẩn |
| `src/lib/news/identity.ts` | Canonical URL, định danh bài, fingerprint SHA-256 |
| `src/lib/news/normalize.ts` | Tách plain text, kiểm tra ngày, ngôn ngữ, độ đủ nội dung |
| `src/lib/news/rank.ts` | Chấm điểm thành phần và chọn bài có đa dạng nguồn |
| `src/lib/news/cluster.ts` | Gợi ý cùng sự kiện, không tự xóa bài |
| `src/lib/sources/catalog.ts` | Danh mục nguồn có ID ổn định và trạng thái kiểm chứng |
| `src/lib/sources/fetch.ts` | HTTP có giới hạn, timeout, redirect và bảo vệ URL |
| `src/lib/sources/health.ts` | Theo dõi kết quả theo nguồn |
| `src/lib/ai/schema.ts`, `src/lib/ai/prompts.ts` | Schema kết quả, prompt version |
| `src/lib/ai/quality.ts`, `src/lib/ai/budget.ts` | Quality gate, usage và ngân sách |
| `src/lib/pipeline/processPending.ts` | Claim và xử lý lại bài trong DB |

Interface chuẩn cần xuất từ `src/lib/news/types.ts`:

```ts
type NewsCategory = 'model-release' | 'open-source' | 'research' | 'tool'
  | 'business' | 'security' | 'policy' | 'general';
type SourceKind = 'official' | 'research' | 'engineering' | 'media' | 'community';
type EvidenceLevel = 'title_only' | 'snippet' | 'abstract' | 'article';
type RawNewsItem = {
  sourceId: string; externalId?: string; sourceUrl: string; articleUrl: string;
  title: string; text: string; publishedAt: string | null; fetchedAt: string;
  language: string | null; evidenceLevel: EvidenceLevel;
};
type NormalizedNewsItem = RawNewsItem & {
  canonicalUrl: string; fingerprint: string; originalText: string;
  category: NewsCategory; qualityFlags: string[];
};
type SourceFetchResult = {
  sourceId: string; status: 'ok' | 'not_modified' | 'failed' | 'disabled';
  items: RawNewsItem[]; httpStatus?: number; errorCode?: string;
  durationMs: number; fetchedAt: string;
};
type ScoreBreakdown = {
  relevance: number; impact: number; credibility: number;
  freshness: number; evidence: number; vietnamRelevance: number;
  penalty: number; total: number; reasons: string[]; version: string;
};
```

- `sourceUrl` là feed/trang thảo luận, `articleUrl` là bài gốc. Không dùng feed URL làm khóa bài.
- Không có article URL hợp lệ: dùng `(sourceId, externalId)` nếu có; nếu không, chỉ lưu quarantined/pending và không auto-publish.
- `fingerprint`: SHA-256 trên nội dung gốc đã chuẩn hóa; khác với identity URL. Bài cập nhật cùng URL phải phát hiện thay đổi nội dung, không tạo bài mới một cách mù quáng.
- Duy trì adapter sang `ArticleData` trong giai đoạn chuyển đổi; không thay tất cả API cùng lúc.

## 6. Chính sách nguồn và mục tiêu độ phủ

### Mục tiêu nghiệm thu nguồn

- Inventory toàn bộ nguồn trong DB, không dùng số lượng trong seed thay cho số lượng hoạt động.
- Thêm ít nhất 8 nguồn độc lập mới đã kiểm chứng, hướng tới tổng tối thiểu 20 nguồn enabled + healthy. Mỗi nguồn mới phải parse được và có mẫu bài hợp lệ; không bật nguồn chết để đủ số.
- Nguồn mới phủ ít nhất 4 nhóm: chính thức/kỹ thuật, nghiên cứu, báo chí, Việt Nam. Mục tiêu có ít nhất 2 nguồn tiếng Việt hoạt động.
- Nhiều subreddit/feed của cùng tổ chức được ghi nhận riêng để vận hành, nhưng không tính là nhiều nhà xuất bản độc lập.
- Nếu mạng/chính sách nguồn khiến mục tiêu chưa đạt: ghi cụ thể thiếu nhóm nào, lỗi gì, nguồn thay thế nào; hoàn thành phần code độc lập và để nghiệm thu live ở trạng thái blocked, không báo hoàn tất toàn bộ.

### Danh sách khảo sát (không phải feed đã kiểm chứng)

| Ưu tiên | Nguồn/nhóm | Trang xuất phát để tìm feed/API chính thức | Ý nghĩa |
|---|---|---|---|
| P0 | OpenAI, Google AI, DeepMind, Hugging Face | URL hiện có trong `prisma/seed.ts` | Rà soát nguồn cốt lõi trước khi thêm mới |
| P0 | NVIDIA Developer / NVIDIA Blog | https://www.nvidia.com/en-us/about-nvidia/rss/ | Inference, GPU, tooling; trang chính thức liệt kê RSS |
| P0 | Microsoft Research | https://www.microsoft.com/en-us/research/blog/ | Nghiên cứu và hệ thống |
| P0 | AWS Machine Learning | https://aws.amazon.com/blogs/machine-learning/ | Ứng dụng AI và triển khai |
| P0 | Google Research | https://research.google/blog/ | Nghiên cứu; chống trùng với DeepMind/Google AI |
| P0 | arXiv cs.AI, cs.CL, cs.LG, cs.CV | https://info.arxiv.org/help/api/index.html | Abstract khoa học; một nhà xuất bản, nhiều nhóm |
| P0 | GitHub Releases: vLLM, Transformers, llama.cpp | https://docs.github.com/en/rest/releases/releases | Release cụ thể, khác với repo nhiều sao |
| P1 | TechCrunch AI, Ars Technica AI | https://techcrunch.com/ ; https://arstechnica.com/ | Báo chí độc lập; lọc đúng chủ đề |
| P1 | The Batch / DeepLearning.AI | https://www.deeplearning.ai/the-batch/ | Tổng hợp chuyên môn; kiểm tra hình thức truy cập |
| P1 | VnExpress Số hóa, VietnamNet Công nghệ | https://vnexpress.net/rss ; https://vietnamnet.vn/ | Tin tiếng Việt; không giả định có feed AI riêng |
| P1 | FPT AI, VinAI | https://fpt.ai/ ; https://www.vinai.io/ | Thông tin AI Việt Nam từ nguồn gốc |
| P2 | Anthropic, Meta AI, Mistral | https://www.anthropic.com/news ; https://ai.meta.com/blog/ ; https://mistral.ai/news | Không bật URL RSS phỏng đoán; chỉ dùng endpoint xác minh |
| P2 | Reddit / Hacker News bổ sung | Tài liệu chính thức của nền tảng và cấu hình nguồn trong DB | Khám phá cộng đồng; không mặc nhiên coi bài đăng là xác nhận sự kiện |

Danh sách là mục tiêu khảo sát, không khẳng định endpoint đang sống. Tại thời điểm viết chỉ đối chiếu tài liệu/trang xuất phát; chưa thực hiện probe và parse từng nguồn. Không dùng dịch vụ RSS trung gian trả phí nếu chưa có yêu cầu.

### Quy trình kiểm chứng một nguồn

1. Tìm feed/API từ chính website hoặc tài liệu nhà cung cấp, ghi discovery URL.
2. Probe qua bộ fetch an toàn; ghi URL cuối, status, content type, thời điểm và latency.
3. Parse được ít nhất một item có title + URL hợp lệ; ghi 3 mẫu gần nhất nếu có. Nguồn lịch sử ít cập nhật vẫn có thể hợp lệ, nhưng báo stale riêng.
4. Kiểm tra độ liên quan AI và tính đầy đủ nội dung; nguồn tin tức tổng hợp cần filter.
5. Ghi cadence, giới hạn request, yêu cầu auth và việc được phép lưu/trích nội dung; không bypass chặn truy cập.
6. Thêm catalog với `verifiedAt`, `verificationStatus`, `publisherKey`, `kind`, `language`, `discoveryUrl`. Chỉ verified mới được đề xuất enable.
7. Lưu bằng chứng vào `docs/reports/source-validation-YYYY-MM-DD.md`; không lưu cookie/token hay toàn văn có bản quyền vào fixture.

## 7. Task T0 — Baseline và DB kiểm thử độc lập

**Files:** sửa `src/lib/prisma.ts`, `prisma.config.ts`, `prisma/seed.ts`, `package.json`; tạo `src/lib/databaseUrl.ts`, `tests/helpers/testDatabase.ts`, `tests/news/database.test.ts`.

**Interface:** `resolveSqliteUrl(value: string | undefined, projectRoot: string): string`; mọi runtime/CLI/seed dùng cùng quy tắc. Mặc định file trong `prisma/dev.db`; `file:./prisma/dev.db` tính từ project root. Với cấu hình cũ `file:./dev.db`, ánh xạ rõ sang database legacy và log cảnh báo chuyển đổi; không tự tạo DB thứ hai âm thầm.

- [x] Ghi baseline: số nguồn theo trạng thái, số bài từng status, cấu hình ngưỡng và các entrypoint thực sự được dùng. Không in secret.
- [x] Test runtime/CLI/seed trỏ cùng DB tạm; absolute path Windows và relative path resolve đúng; không đụng DB thật.
- [x] Cài test runner dùng `node:test` + `tsx` hiện có; tạo script `test:news` chạy `tsx --test tests/news/*.test.ts`.
- [x] Chạy test baseline và ghi các lỗi hiện hữu riêng với lỗi do thay đổi.

**Nghiệm thu:** test dùng database tạm; không thay đổi `prisma/dev.db`; dependency/runtime thiếu được báo đúng, không coi là lỗi logic.

## 8. Task T1 — Sửa định danh và chống trùng làm mất tin

**Dependency:** T0. **Files:** tạo `src/lib/news/types.ts`, `src/lib/news/identity.ts`, `tests/news/identity.test.ts`; sửa pipeline, RSSCrawler, utils, schema; migration tên `news_identity`.

**Interfaces:** `normalizeArticleUrl(url: string): string | null`; `getIdentityKey(item: RawNewsItem): string | null`; `fingerprintContent(title: string, text: string): string`.

- [ ] Viết fixture/test: 2 bài khác URL cùng feed đều được giữ qua hai lượt crawl; cùng URL khác UTM chỉ tạo một bài; query ID có nghĩa phải được giữ.
- [ ] Test title gần giống nhưng model version/ngày/release ID khác không bị loại; so tiêu đề gốc với tiêu đề gốc.
- [x] Loại `sourceUrl` là feed khỏi exact dedupe; dùng canonical article URL hoặc source/externalId. Không dùng hash 32-bit làm khóa duy nhất. (Mã đã triển khai; chưa chạy test theo yêu cầu phiên T1.)
- [ ] Thêm identity nullable có unique constraint; backfill trên bản sao DB, xuất báo cáo collision trước khi áp constraint. Không xóa các bài cũ bị trùng; giữ chúng, chỉ chọn một bản sở hữu identity và lưu liên kết duplicate.
- [ ] Test hai insert cùng identity đồng thời trả cùng article hoặc xử lý conflict, không tạo hai bài.
- [ ] Test cùng URL nhưng fingerprint đổi: ghi dấu cần review/update; không tự đổi nội dung bài published hoặc gửi Telegram lại.

**Chạy:** `npx tsx --test tests/news/identity.test.ts`. **Nghiệm thu:** tất cả case trên pass, slug cũ giữ nguyên.

**Cập nhật phiên T1:** Không tạo/chạy test theo yêu cầu người dùng. Đã thêm schema/migration `20261030090000_news_identity`, công cụ chuẩn bị snapshot/backfill và xử lý conflict/content-change; chưa chạy migration hoặc công cụ trên DB nào. Checkbox có nội dung test/backfill thực tế vẫn để mở; T1 chưa đủ cổng nghiệm thu để tự chuyển T2.

## 9. Task T2 — Danh mục nguồn và thu thập có quan sát được

**Dependency:** T1. **Files:** tạo `sources/catalog.ts`, `sources/fetch.ts`, `sources/health.ts` trong `src/lib/`; sửa các crawler, nguồn API/UI, seed, schema; tạo `tests/news/sources.test.ts`, `tests/news/safe-fetch.test.ts`.

**Interfaces:** `fetchSource(source: SourceConfig): Promise<SourceFetchResult>`; `probeSource(source: SourceConfig): Promise<SourceProbeResult>`. Định nghĩa/export `SourceConfig` và `SourceProbeResult` trong `src/lib/sources/catalog.ts` gồm DB id, catalogId, publisherKey, kind, URL, enabled, intervalMinutes, timeoutMs, maxItems, verificationStatus và kết quả parse/HTTP. SourceConfig không chứa secret trực tiếp, chỉ tham chiếu tên biến môi trường nếu cần.

- [x] Migration thêm metadata nguồn, `lastAttemptAt`, `lastSuccessAt`, `lastError`, `consecutiveFailures`, ETag/Last-Modified; thêm `SourceFetchLog` lưu runId, sourceId, status, fetchedCount, durationMs, errorCode. (Schema/SQL đã viết; chưa áp migration.)
- [ ] Test seed/import chạy lại giữ nguyên enabled/URL/config đã chỉnh; nguồn catalog mới mặc định disabled đến khi verified. Stable catalogId không phụ thuộc tên hiển thị.
- [x] Refactor crawler để lỗi từng nguồn xuất hiện trong kết quả và CrawlRun; một nguồn lỗi không dừng các nguồn khác. (Mã đã triển khai, chưa test hành vi.)
- [x] HN/Reddit/GitHub đọc tham số DB đã validate thay vì ignore URL/config hoặc giới hạn vào danh sách hardcode. Không fetch URL tùy ý bằng token GitHub/Reddit; auth chỉ gửi đến host API được phép. (Mã, chưa chạy crawl.)
- [x] Bộ HTTP: mặc định timeout 10s, tối đa 3 redirect, response giải nén tối đa 2 MB, concurrency toàn cục 3 và tối đa 1/host. Áp giới hạn nhà cung cấp nếu chặt hơn; hỗ trợ ETag/Last-Modified và 304. (Process-local; ETag chỉ checkpoint sau lưu candidate, chưa test.)
- [x] Chỉ cho HTTP(S), ưu tiên HTTPS; chặn credentials trong URL, localhost, private/link-local/reserved IPv4/IPv6. Validate DNS và từng redirect, tránh DNS rebinding bằng kết nối tới địa chỉ đã kiểm tra; dùng thư viện phù hợp nếu cần, không chỉ kiểm tra chuỗi hostname. (Mã dùng ipaddr.js + pinned lookup; chưa security/runtime test.)
- [ ] Test 200 HTML giả feed, XML hỏng, 304, 403, 429/Retry-After, timeout, oversized body, redirect/private IPv6; 304 là not_modified, không phải failed hoặc một lượt có bài mới.
- [x] Backoff nguồn lỗi 15m → 1h → 6h (giới hạn 24h cho Retry-After dài); không tự đổi enabled. Admin nhìn thấy health và có nút kiểm tra nguồn qua API được bảo vệ. (Mã API/UI, chưa HTTP/browser test.)

**Chạy:** `npx tsx --test tests/news/sources.test.ts tests/news/safe-fetch.test.ts`. **Nghiệm thu:** không mất lỗi trong thống kê, không phụ thuộc mạng thật để chạy test.

## 10. Task T3 — Mở rộng nguồn theo từng đợt

**Dependency:** T2. **Files:** cập nhật catalog/seed/admin allowedTypes; tạo `scripts/probe-sources.ts`, `scripts/import-source-catalog.ts`, `src/crawlers/ArxivCrawler.ts`, `src/crawlers/GitHubReleaseCrawler.ts`, `tests/news/source-adapters.test.ts`; fixture tại `tests/fixtures/sources/`.

- [x] Viết probe CLI hỗ trợ `--catalog-id`, `--all`, `--dry-run`; không đổi DB trong dry-run, không gọi AI. (Thêm cả import CLI với readonly dry-run; chưa chạy CLI.)
- [ ] Đợt 1: rà soát nguồn hiện có; thêm tối thiểu 4 nguồn chính thức/kỹ thuật từ danh sách khảo sát sau khi verify.
- [x] Đợt 2: arXiv abstract cho 4 nhóm cs.*, tối đa 20 item/lượt/nhóm, lookback 7 ngày; dedupe bằng arXiv ID + version, giữ liên hệ phiên bản bài. Đọc tài liệu API và giới hạn hiện hành trước khi dùng. (Adapter/catalog đã viết; chưa probe. Cadence mặc định 1 ngày, 3.1s/request, một kết nối/process.)
- [ ] Đợt 2: GitHub Releases cho vLLM, Transformers, llama.cpp; kiểm chứng owner/repo bằng API, dùng release ID/tag, không lấy số sao làm bằng chứng đã ra phiên bản.
- [ ] Đợt 3: bổ sung báo chí và ít nhất 2 nguồn tiếng Việt hợp lệ; dùng filter AI chung, không gắn mọi bài công nghệ là AI.
- [ ] Test RSS 2.0, Atom, namespace/content:encoded, tiếng Việt, thiếu ngày, arXiv có nhiều category, GitHub prerelease/draft. Draft bỏ qua, prerelease gắn nhãn và cần review.
- [ ] Đối chiếu mục tiêu 8 nguồn mới/20 tổng ở mục 6 bằng báo cáo live. Nguồn chưa xác minh giữ disabled với lý do cụ thể.

**Nghiệm thu:** import lặp không tạo nguồn trùng; mỗi nguồn enabled mới có bằng chứng probe/parse; không thay nguồn đã tắt. Chạy `npx tsx --test tests/news/source-adapters.test.ts`, sau đó probe live riêng nếu mạng cho phép.

**Cập nhật phiên T2–T5:** Catalog có 19 endpoint ứng viên (12 RSS, 4 arXiv, 3 GitHub Releases), không phải 19 publisher độc lập. Adapter Releases bỏ draft, flag prerelease, giữ ID/tag và có bước API kiểm tra owner/repo khi probe; bước này chưa chạy live nên checkbox nghiệm thu Releases vẫn mở. Nguồn mới import/seed mặc định disabled/unverified; không tự enable sau probe. Báo cáo `docs/reports/source-validation-2026-10-30.md` ghi rõ chưa đạt bằng chứng 8 nguồn mới / 20 healthy / 2 nguồn Việt hoạt động. Chưa import, seed, probe hoặc migrate DB nào.

## 11. Task T4 — Chuẩn hóa nội dung và bằng chứng

**Dependency:** T1–T3. **Files:** tạo `news/normalize.ts`, `tests/news/normalize.test.ts`; sửa types, crawler và pipeline; migration `news_evidence`.

**Interface:** `normalizeNews(item: RawNewsItem): NormalizedNewsItem`; `assessEvidence(item: NormalizedNewsItem): { eligibleForAI: boolean; requiresReview: boolean; reasons: string[] }`.

- [x] Lưu riêng originalTitle, originalText, originalLanguage, evidenceLevel, fetchedAt, originalPublishedAt nullable; không ghi nguyên văn tiếng Anh vào field được mô tả là bản dịch tiếng Việt mới. (Mã/schema; chưa migration/runtime.)
- [x] Chuẩn hóa HTML/entities/whitespace bằng parser, bỏ script/style/navigation; fixture chỉ dùng nội dung tự tạo hoặc trích đoạn được phép. (Cheerio đã dùng; không tạo fixture theo yêu cầu bỏ test.)
- [x] Thay gate `text.length >= 80` bằng kiểm tra nội dung độc lập tiêu đề: `title_only` luôn review; abstract/snippet ít nhất 160 ký tự có ý nghĩa mới eligible. Ngắn hơn lưu pending với reason, không bỏ mất bài. (Mã, chưa behavioral test.)
- [x] Với link HN/Reddit chỉ có title: thử lấy mô tả/nội dung bài gốc bằng fetch an toàn, tối đa 1 lần/bài/lượt, không render JS hoặc truy cập paywall. Lỗi lấy nội dung giữ pending. (Phát hiện paywall best-effort, không phải giấy phép lưu nội dung; chưa fetch live.)
- [x] Ngày tương lai >24h, ngày không hợp lệ hoặc không có ngày: gắn flag, không tự gán fetchedAt thành publishedAt. Bài quá 30 ngày không tự xuất bản như tin mới; release/bản cập nhật cần ngày sự kiện riêng. (Adapter Releases dùng published_at, arXiv giữ ID/version; chưa test.)
- [ ] Test snippet lặp title không thành evidence tốt; nội dung tiếng Việt giữ dấu; script HTML không đi vào prompt/render; nguồn không đủ dữ kiện không tự publish dù điểm cao.

**Chạy:** `npx tsx --test tests/news/normalize.test.ts`. **Nghiệm thu:** mọi candidate có provenance và reason khi chưa đủ dữ kiện.

## 12. Task T5 — Chấm điểm, đa dạng nguồn và gom sự kiện

**Dependency:** T4. **Files:** tạo `news/rank.ts`, `news/cluster.ts`, `tests/news/rank.test.ts`, `tests/news/cluster.test.ts`; sửa scoring/pipeline/settings/categories UI; migration `news_ranking`.

**Interfaces:** `scoreNews(item: NormalizedNewsItem, context: RankingContext): ScoreBreakdown`; `selectCandidates(items: RankedCandidate[], limits: SelectionLimits): RankedCandidate[]`; `suggestCluster(item: NormalizedNewsItem, recent: ClusterCandidate[]): { clusterId: string | null; confidence: number; reasons: string[] }`. Export context/candidate types tại `news/types.ts`; context gồm clock, source kind, evidence và tín hiệu sự kiện, không lấy Date.now bên trong scorer.

- [x] Chuẩn hóa category: tool-release→tool, industry→business; breakthrough phân loại lại theo nội dung hoặc general. Giữ khả năng đọc giá trị legacy, không làm mất bài khỏi bộ lọc. (Mã aliases API/category page/card/admin; không backfill bài published.)
- [x] Điểm 0–100: relevance 0–25, impact 0–25, credibility 0–15, freshness 0–15, evidence 0–15, vietnamRelevance 0–5, penalty 0–40; total clamp tổng điểm trừ penalty. Ghi scoreVersion và breakdown JSON. (news-rank-v1, chưa test.)
- [x] Relevance không match `ai` trong `chair`, `email`, `said`; không thưởng chỉ vì nhắc GPT/Claude. Impact dựa loại sự kiện và bằng chứng (release/chính sách/lỗ hổng/benchmark), không dựa tên phiên bản cố định. (Mã, chưa test.)
- [x] Credibility phản ánh xuất xứ; nguồn chính thức vẫn là tuyên bố của nhà cung cấp. Freshness: ≤24h:15, ≤72h:10, ≤7d:5, cũ hơn/không rõ:0; tương lai bất thường:0 + review. (Scorer dùng clock truyền vào.)
- [x] Thống nhất publish threshold mặc định 75, review threshold 60. Giới hạn AI tối đa 10 bài/lượt giữ nguyên; tối đa 2 bài/publisher/lượt, tối đa 3 community, không ép đủ quota nếu thiếu bài đủ chất lượng. Bài chưa chọn nằm trong backlog. (Mã giữ setting DB hiện có, clamp runtime; Repo Radar dùng phần ngân sách bài còn lại, chưa có lease/budget bền vững T7.)
- [ ] Test cùng input/clock luôn cùng điểm khi gọi nhiều lần (bắt regex global state); tin nhiễu có tên model không vượt tin release đầy đủ; lựa chọn không bị một nhà xuất bản chiếm hết.
- [x] Gom sự kiện trong cửa sổ 72h dựa entity + event type + version + ngày. Không merge tự động chỉ dựa title similarity; ambiguous ghi suggestion cần admin review. Dùng DB cluster/links, giữ riêng các bài và nguồn. (Heuristic bảo thủ có product variant/CVE; confidence không phải xác suất được kiểm chứng. Chưa test hoặc nghiệm thu editor workflow.)
- [ ] Test cùng sự kiện từ 3 nguồn gợi ý cùng cụm; khác model version hoặc sự kiện khác không gộp; tin cập nhật có thể liên kết nhưng không biến mất.

**Chạy:** `npx tsx --test tests/news/rank.test.ts tests/news/cluster.test.ts`. **Nghiệm thu:** giải thích được vì sao được chọn/không chọn; số bài mới không giảm vì quota xóa bài.

## 13. Task T6 — AI có hợp đồng đầu ra và kiểm soát chất lượng

**Dependency:** T4–T5. **Files:** sửa `ai/openRouter.ts`; tạo `ai/schema.ts`, `ai/prompts.ts`, `ai/quality.ts`, `tests/news/ai.test.ts`; migration `ai_processing_trace`.

**Interface:** `processArticleWithAI(input: AiArticleInput): Promise<ValidatedAiResult>`; export tại `ai/schema.ts`. Input chứa originalTitle, originalText, evidenceLevel, source references và policy flags; output giữ các field cũ để tương thích, thêm `claims`, `uncertainties`, `qualityFlags`, `promptVersion`, `schemaVersion`. Mỗi claim phải tham chiếu evidence ID do server cấp, không nhận URL mới do model tự tạo.

- [x] Schema runtime (validator tương đương) kiểm tra object/kiểu/required/enum/claims, titleVi 90, briefVi 450, whyImportant 800, aiTags tối đa 8. (Mã đã typecheck/lint; chưa behavioral test.)
- [x] Prompt v1 coi nguồn là dữ liệu không tin cậy, không làm theo chỉ dẫn trong bài; giữ tên/phiên bản/đơn vị/giá/mức chắc chắn, không suy diễn benchmark. (Mã, chưa chứng minh hiệu quả với provider.)
- [x] Hai cờ dịch/reason độc lập, cả hai tắt không gọi AI; field của chức năng tắt được đưa về rỗng. Repo AI cũng dùng cờ độc lập. (Chưa test các tổ hợp.)
- [x] Validation trong từng attempt. Đọc docs OpenRouter structured outputs/Chat Completions/errors; chọn JSON mode + local validation vì strict JSON Schema tùy endpoint. Không xác nhận capability/pricing của model live.
- [x] Retry tối đa 3 model/6 call, một retry/model; 401/402/403 dừng, 429/5xx/timeout có lịch/backoff; refusal/content_filter không vòng qua model khác. (Mã, chưa mock/live test.)
- [x] Deadline network 120s/bài, timeout 30s/call, backoff 2s rồi 4s+jitter; Retry-After quá deadline trả lịch retry bền vững. (Chưa kiểm chứng timing thực, DB/local overhead không có hard real-time guarantee.)
- [x] AiAttempt lưu article/repo/request ID, provider/model thực trả, latency, tokens/cost nullable, errorCode, prompt/schema versions. Select public không thêm trace; detail admin tối đa 20 attempt. (Chưa HTTP security/runtime test.)
- [x] Quality heuristic gắn review cho số/model/entity phổ biến, URL, evidence ID không tồn tại, rumor/instruction/uncertainty. Citation không chứng minh tính đúng của claim; không có semantic factual verifier hoặc confidence calibration, còn cần human review T9. (Mã, chưa đánh giá độ chính xác.)
- [ ] Test response thiếu field, array/null thay object, JSON có markdown, sai enum, refusal, 429, timeout, unknown usage, prompt injection trong nguồn, số liệu bịa, translation-only/reason-only.

**Chạy:** `npx tsx --test tests/news/ai.test.ts`. **Nghiệm thu:** tất cả test dùng mock provider; không auto-publish khi quality gate yêu cầu review.

## 14. Task T7 — Backlog AI, retry bền vững và ngân sách

**Dependency:** T6. **Files:** tạo `pipeline/processPending.ts`, `ai/budget.ts`, `tests/news/pending.test.ts`, `tests/news/budget.test.ts`; sửa pipeline, repoRadar, settings và schema; tạo `scripts/process-pending.ts`.

**Interfaces:** `processPendingArticles(options: { limit: number; dryRun: boolean }): Promise<ProcessingSummary>`; `reserveAiBudget(attemptId: string, estimatedUsd: number): Promise<boolean>`; `settleAiBudget(attemptId: string, actualUsd: number | null): Promise<void>`. Export `ProcessingSummary` từ processPending: selected, processed, published, review, failed, skippedBudget và errors.

- [x] Article.status tách processingStatus, lưu attempts/retry/lease/version/inputHash/claims; migration additive, legacy default review, không sửa published/slug. (Chưa áp migration.)
- [x] Conditional atomic claim, lease 5 phút gia hạn trước attempt, batch lease có owner; network ngoài transaction, complete kiểm tra owner/lease/fingerprint. Admin edit/source đổi thu hồi lease và chuyển review. (Chưa concurrency test.)
- [x] Mã CAS/expired lease recovery và cache articleId/inputHash/promptVersion/schemaVersion đã nối; hash gồm flags, cache hỏng yêu cầu review. Repo dùng namespace riêng cùng cache/budget. (Chưa chứng minh two-worker/crash behavior.)
- [x] Retry durable, cấu hình/evidence/schema/refusal chờ sửa/reprocess có audit; các delay 5m/30m/2h và giới hạn 3 chu kỳ. Chu kỳ 3 lỗi là terminal nên không có retry lần 4 sau 2h; budget chưa gọi không tiêu chu kỳ generation và có lịch chờ. (Chưa runtime test.)
- [x] Worker tối đa 10 bài AI, Repo Radar tối đa 10 repo, publish tối đa min(10, setting); ngân sách chung. Mọi candidate lưu trước AI, quét backlog đến hạn không cắt ở 1.000 bài cũ nhất. Dry-run readonly chọn/ước lượng upper-bound, không writes/AI/Telegram. (Chưa chạy CLI.)
- [x] Operator budget/token/pricing + explicit AI enable là bắt buộc, không giá hardcode/auto routing; reserve atomic micro-USD từng call, settle cost hoặc usage+bảng giá đúng model; unknown giữ reservation. (Mã, chưa kiểm chứng atomic/cost thật.)
- [x] Reservation từng attempt, failed call vẫn settle nếu provider báo cost; ngày UTC và UI known/reserved/unknown/unsettled riêng. Crash không tự refund. Không hứa exactly-once cho provider/Telegram; lease/reservation chỉ giới hạn rủi ro gọi lặp. (Chưa crash test.)
- [x] Bypass dịch chỉ cho original tiếng Việt phù hợp; không bypass AI error/quality/evidence/date/rank. Auto-publish opt-in riêng, mặc định false; ready không bị gọi AI lại khi cờ tắt. (Chưa publication/Telegram behavior test.)
- [ ] Test backlog ngoài top 10 được xử lý ở lượt sau, lỗi AI không bị dedupe loại mất, hai worker, restart, hết budget, chi phí unknown, không gửi Telegram khi dry-run/review. Không hứa exactly-once cho call bên ngoài khi crash sau gửi; ghi rõ khả năng gọi lặp và giới hạn bằng lease/reservation.

**Chạy:** `npx tsx --test tests/news/pending.test.ts tests/news/budget.test.ts`. **Nghiệm thu:** recover được tác vụ, chạm budget dừng có lý do và không mất bài.

## 15. Task T8 — Admin và tích hợp CLI/Docker

**Dependency:** T2–T7. **Files:** sửa admin sources/articles/crawl-logs/settings và API tương ứng; thêm `src/app/api/admin/articles/[id]/reprocess/route.ts`; sửa Dockerfile, .dockerignore, README/.env.example; test `tests/news/admin-workflow.test.ts`.

- [x] Nguồn hiển thị publisher/kind/language, lần thử/thành công, probe/enabled, 304/error/stale qua last fetch log. (Chưa browser/live acceptance.)
- [x] Bài có original/AI cạnh nhau, evidence/claims/score, processing/retry, trace giới hạn/audit; approve/reject/edit/reprocess giữ slug. Endpoint POST reprocess chỉ enqueue. (Chưa HTTP/browser test.)
- [x] Guard/validation, CAS edit và audit actor/time/action/before-after atomic cho article/settings/repo edits; approve quality exceptions cần xác nhận/lý do, published không reprocess in-place. Repo discovery publish lưu pending trước rồi approve+audit, không lấy mô tả English làm summaryVi. (Mã, chưa behavioral/security test.)
- [ ] Test anonymous 401, pending public 404, public không lộ trace; chưa chạy theo yêu cầu không test.
- [x] Analytics/stats hiển thị UTC daily budget, known USD/reserved unknown+unsettled, lỗi source/model, backlog age/status và coverage nhóm nguồn. Crawl logs thêm AI/duplicate/repo/warnings. (Chưa UI/DB nghiệm thu.)
- [x] Docker giữ lockfile/npm ci, runner có src/scripts/tsconfig/prisma.config; build DB /tmp không copy vào runner, entrypoint dùng resolver T0 và không tự migrate/seed/chmod world-writable. (Chưa build/container.)
- [ ] Trên DB tạm trong container: migration, seed, import nguồn dry-run, pipeline fixture và process-pending dry-run đều chạy. Không mount database người dùng cho test migration.
- [x] README/.env.example mô tả CLI/flags/budget/limits/unknown/crash window; seed tạo khóa thiếu, không overwrite cấu hình có. Pending cron tick đọc enable/schedule/limit mỗi lượt, UTC/checkpoint có điều kiện, cùng helper trong app scheduler/system cron. (Chưa khởi chạy lịch.)
- [x] Chứng minh seed lặp với schema mới giữ override: T9 chạy trên hai DB tạm absolute/relative, áp đủ 9 migration, seed CLI hai lần và seed trực tiếp; giữ enabled/URL/type/config/settings/slug. Không seed/migrate DB thật; Docker vẫn chưa kiểm chứng.

**Nghiệm thu:** web/API/CLI đều dùng cùng pipeline và DB; không chỉ test API read để kết luận crawler chạy được.

## 16. Task T9 — Benchmark và triển khai theo cổng nghiệm thu

**Dependency:** T8. **Files:** tạo `tests/fixtures/news-eval/`, `scripts/evaluate-news.ts`, `docs/reports/news-quality-baseline.md`, `docs/reports/news-quality-after.md`; sửa package scripts; cập nhật file kế hoạch này.

- [ ] Bộ tối thiểu 120 case cố định: 30 tin release/chính sách/sự kiện có nguồn, 20 bài nghiên cứu, 20 cặp trùng/cùng sự kiện/khác version, 20 tin nhiễu/rumor/quảng cáo, 15 case tiếng Việt, 15 case thiếu dữ kiện/injection/ngày lỗi. Case cặp được tính là một case; lưu gold label và giải thích. T9 đã tạo đủ 120 case đúng cơ cấu nhưng TOÀN BỘ synthetic, URL `.invalid`, nhãn AI provisional, không phải tin có nguồn thật/gold. Phần dữ liệu sourced/human gold còn thiếu, không đánh dấu hoàn tất yêu cầu này.
- [x] Tách 80 case hiệu chỉnh và 40 holdout cố định trước lượt đo đầu; pin SHA-256, không sửa nhãn/scorer để đạt điểm. Nhãn do AI tạo ghi provisional. Split v1 grouped, không đại diện: 5 case tiếng Việt holdout đều negative nên recall tiếng Việt chưa đo được; không lấy đó làm nghiệm thu nội dung. Cần v2 do người duyệt với fresh holdout riêng.
- [x] Chạy baseline rule cũ và mới trên cùng fixture/clock; mock AI cho regression. Baseline pin commit/hash, replay scorer và persisted dedupe predicates; không tuyên bố replay toàn old crawler. Live AI tách riêng, chưa chạy/không được tự bật; mock không phải bằng chứng chất lượng bản dịch thật.
- [x] Báo cáo relevance precision/recall, exact-dedupe false positive, cluster precision, tỷ lệ review với mẫu số/split/fail IDs. Schema mock 12/12 assertion không phải live pass rate; schema live/cost/bài/provider latency/source success để N/A với 0 mẫu. Thời gian rule local có ghi nhưng không phải end-to-end/provider. Hai báo cáo Markdown và JSON từng case đã sinh.
- [ ] Ngưỡng đích holdout: precision chọn tin ≥90%, recall tin quan trọng ≥85%, false positive exact-dedupe =0 trong test, schema pass sau fallback ≥98% trên tập live đủ mẫu. Không khẳng định 98% từ 10 mẫu: nếu chưa có ít nhất 100 output live, báo số quan sát và để chỉ tiêu live chưa đủ dữ liệu.
- [ ] Human review ít nhất 30 bản tin live: đúng nguồn, đúng số/model/version, không thêm claim không có căn cứ; mọi lỗi factual nghiêm trọng phải sửa và chạy lại nhóm test liên quan. Không chỉ dùng LLM-as-judge để tự duyệt.
- [ ] Chạy shadow mode tối thiểu 3 lượt crawl: không auto-publish/Telegram; so nội dung, nguồn và chi phí. Sau đó bật từng nhóm verified, giữ khả năng tắt nguồn/model bằng config.

**Commands cần được tạo/duy trì:**

```powershell
npm ci
npm run test:news
npm run lint
npm run build
npx tsx scripts/probe-sources.ts --all --dry-run
npx tsx scripts/import-source-catalog.ts --dry-run
npx tsx scripts/process-pending.ts --dry-run --limit 10
npx tsx scripts/evaluate-news.ts --mode offline
```

`probe-sources` dùng mạng nhưng không ghi DB ở dry-run. `evaluate-news --mode offline` không mạng/AI trả phí/Telegram. Các lệnh chưa tồn tại tại thời điểm lập kế hoạch phải được tạo trong task tương ứng; không chạy ngay và diễn giải lỗi thiếu file là regression.

## 17. Thứ tự, rollback và điều kiện hoàn tất

Thứ tự: T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9. Có thể tách T3 thành nhiều phiên; không bật hàng loạt nguồn mới trước khi T1/T2 qua test. Việc khảo sát endpoint có thể tiếp tục trong khi các task còn lại đang làm.

Mỗi task: ghi test thất bại ban đầu nếu sửa bug, triển khai tối thiểu, chạy test cụ thể và `test:news`, rà diff; commit theo quy tắc phiên hiện hành, không tự push. Nếu dependency bên ngoài chặn, ghi blocked ở sub-step và làm phần độc lập có ý nghĩa.

Rollback: ưu tiên cờ tắt pipeline mới/nguồn mới và dừng lịch xử lý. Không đảo migration bằng cách drop dữ liệu mới trên DB thật. Nếu cần restore, dùng bản backup đã thử restore trên DB riêng; nêu rõ dữ liệu phát sinh sau backup sẽ cần đối soát. Published hiện có không tự bị unpublish khi đổi scorer.

Hoàn tất khi có đủ: test offline pass; build/lint pass hoặc lỗi baseline đã xác minh và báo rõ; bằng chứng nguồn live đạt mục tiêu; benchmark/human review đạt cổng; CLI chạy trong Docker với DB tạm; không ghi đè cấu hình nguồn; không rò trace/secret qua public API; tài liệu vận hành và nhật ký bàn giao cập nhật. Thiếu live key/ngân sách/nhãn người duyệt thì báo phần triển khai xong và phần nghiệm thu còn thiếu, không tự đánh dấu tất cả done.

## 18. Tài liệu tham chiếu

- Repo: `AGENTS.md`, `README.md`, `prisma/schema.prisma`, mã nguồn mục 3 là nguồn sự thật về trạng thái hiện tại.
- NVIDIA RSS chính thức: https://www.nvidia.com/en-us/about-nvidia/rss/ (đã đối chiếu trang liệt kê feed khi viết; cần probe URL feed thực tế).
- arXiv API: https://info.arxiv.org/help/api/index.html (đọc lại tài liệu và điều khoản trước khi triển khai adapter).
- GitHub Releases: https://docs.github.com/en/rest/releases/releases (kiểm chứng API version/rate limits khi thực thi).
- OpenRouter: https://openrouter.ai/docs (kiểm chứng JSON Schema, provider routing và usage/cost đúng endpoint chat completions hiện dùng; không đổi sang Responses chỉ vì tìm thấy ví dụ).

## 19. Bảng tiến độ và nhật ký bàn giao

| Task | Trạng thái | Bằng chứng / phần tiếp theo |
|---|---|---|
| T0 Baseline + DB test | DONE (offline) | 15/15 test pass; migration/seed/runtime và CLI chẩn đoán dùng DB tạm; lint/typecheck pass; hash hai DB thật và lockfile không đổi. Nhật ký 2026-10-30 bên dưới. |
| T1 Identity/dedupe | IMPLEMENTED / PARTIALLY VERIFIED OFFLINE | T9 kiểm tra20cặp identity và migration trên DB tạm; chưa snapshot/backfill dữ liệu cũ, insert race/2crawl đầy đủ, chưa đủ nghiệm thu T1. |
| T2 Catalog/fetch/health | IMPLEMENTED / UNVERIFIED | Schema, safe HTTP, crawler chung, health/backoff, guarded probe và admin UI; generate/typecheck/lint pass. Chưa test/migrate/HTTP. |
| T3 Mở rộng nguồn | CODE IMPLEMENTED / LIVE UNVERIFIED | 19 endpoint ứng viên, arXiv/Releases adapters, import/probe CLI; nguồn mới disabled. Chưa xác minh nguồn, chưa đạt bằng chứng 8 mới / 20 healthy / 2 Việt. |
| T4 Evidence/normalize | IMPLEMENTED / PARTIALLY VERIFIED OFFLINE | T9 fixture15edge kiểm tra evidence/date/injection review/không chọn tự động; chưa HTML/enrichment/parser/live toàn phần. |
| T5 Ranking/clustering | IMPLEMENTED / PARTIALLY VERIFIED OFFLINE | T9 determinism/quota/20cặp cluster pass; benchmark provisional holdout recall62,5% chưa đạt85%, không nghiệm thu chất lượng. |
| T6 AI schema/quality | IMPLEMENTED / PARTIALLY VERIFIED OFFLINE | T9 schema/quality12assertion + mock provider fallback/refusal/429 pass; chưa live>=100, factual/human30 hoặc timing network toàn phần. |
| T7 Pending/budget | IMPLEMENTED / PARTIALLY VERIFIED OFFLINE | T9 budget competing reservations/unknown/idempotence, backlog2+1/cache/readonly CLI pass DB tạm; chưa crash/recovery/lease race/Repo/cron acceptance đầy đủ. |
| T8 Admin/Docker | IMPLEMENTED / PARTIALLY VERIFIED OFFLINE | T9 seed lặp giữoverride/schema9migration và sandbox production webpack build36/36 pass; HTTP/security/browser/container chưa nghiệm thu. |
| T9 Evaluation/rollout | OFFLINE EXECUTED / GATES NOT MET | 120 case synthetic/provisional, 80/40 frozen; test 23/23, lint/typecheck/sandbox webpack build pass. Holdout precision 10/10, recall 10/16 (62,5% <85%), exact-dedupe FP 0/5, cluster 4/4. Chưa sourced/human gold/live>=100/human>=30/shadow>=3; không rollout. Nhật ký bên dưới. |

Ghi chú T9 cho T1–T8: regression offline đã kiểm tra một phần identity/cluster/evidence/quota, AI fallback/budget/backlog/cache/readonly CLI, migration/seed và build. Không đổi các task trước thành DONE: chưa đủ HTTP/security/browser/container/crash/real source coverage. Build sandbox không thay thế Docker acceptance.

### Nhật ký 2026-10-30 — T9: Chạy offline, chưa đạt cổng rollout

**Yêu cầu:** "Chạy T9 và đưa ra kết quả". Chạy benchmark/regression trên fixture, mock AI, DB tạm; không tự cho phép live AI, nguồn live, production publish hay Telegram. Giữ dirty worktree có sẵn; không commit/push/reset. Đọc AGENTS và Next environment guide hiện cài trước khi thêm harness.

**Mã/báo cáo:** `tests/fixtures/news-eval/cases.ts` gồm 120 case đúng 30/20/20/20/15/15, cặp tính một case. Tất cả synthetic, nhãn AI provisional có giải thích, `.invalid`, không phải current news. `tests/helpers/newsEvaluation.ts`, `scripts/evaluate-news.ts` so rule scorer thực từ Git commit `bff8718407cc157de2b4b183c1e817d6c193be30` với scorer mới; fixed clock `2026-10-30T12:00:00.000Z`, threshold 75. Pin baseline sau lượt đầu, không trôi theo HEAD. VM giữ thuật toán/regex cũ; dedupe persisted cùng feed/title được replay từ pipeline cũ, không replay crawler-specific adjustments/AI/DB insert nên chỉ là rule-level comparison.

**Fixture freeze:** split 80 calibration / 40 holdout trước lượt chạy đầu; pair holdout gồm cả positive/negative. SHA-256 `10fade89e4838f859ce1c1c96b8b9a10cbe0226a58436adfe4e941518f236833` có regression bảo vệ. Sau khi xem kết quả không sửa nhãn, scorer hoặc threshold. Split grouped không đại diện, padding synthetic không phải evidence thật, historical sourceName được tổng hợp; 5 case Việt holdout đều negative. Những hạn chế này được ghi vào cả báo cáo. Không tune v1 holdout; cần sourced/human-reviewed v2 + fresh stratified holdout.

| Metric | Baseline all | Mới all | Baseline holdout | Mới holdout |
|---|---|---|---|---|
| Selection precision | 7/9 = 77,78% | 47/47 = 100% | N/A (0 selected) | 10/10 = 100% |
| Important recall | 7/60 = 11,67% | 47/60 = 78,33% | 0/16 = 0% | 10/16 = 62,5%, FAIL mục tiêu 85% |
| Exact dedupe FP / cặp khác bài | 15/15 | 0/15 | 5/5 | 0/5 |
| Cluster precision / gợi ý | N/A (chưa có cluster) | 10/10 | N/A | 4/4 |
| Review evidence mới | Không so trực tiếp policy cũ | 20/100 | Không so trực tiếp policy cũ | 7/33 |

Selection đo 100 case đơn, loại 20 cặp khỏi mẫu số relevance; từng case độc lập qua `selectCandidates(limit=1)` nên top10 không giới hạn recall giả tạo. Quota 10/2publisher/3community được regression riêng. Cũ có review proxy = unselected, mới = evidence flags, không dùng để khẳng định review quality tăng. Cluster chỉ suggestion không merge, sample nhỏ không đủ production precision. JSON lưu từng case/breakdown; Markdown ghi mẫu số, misses, chi phí/latency/source live N/A, local rule timing không coi là provider latency/throughput.

**6 important holdout misses:** `events-22`, `events-27`, `events-29`, `research-16`, `research-17`, `research-19`. Năm case relevance=0 từ lexicon hiện tại nên total 40/45; `research-16` relevance15/total73 dưới75. Không sửa scorer theo holdout; bước cải thiện sau cần nhóm calibration riêng và một holdout mới chưa xem. Không báo ngưỡng recall đã đạt.

**Regression:** `tests/news/evaluation.test.ts` kiểm tra cấu trúc/hash fixture, determinism lặp, 20 cặp identity/cluster, quota, 15 edge review/không auto-select, schema/quality mock 12 assertion và gate reporting. `tests/news/processing.test.ts` áp migration trên DB tạm, fake key/provider và socket cấm: primary schema lỗi hai lần rồi fallback success (3 calls), refusal không fallback (1 call), HTTP429/Retry-After300s dừng deadline (1 call), cả hai tính năng off không gọi; atomic competing reservations chỉ một thắng, unknown giữ reserved/idempotent, trần chặn thêm. Backlog3 bài qua batch2+1, ready không gọi lặp, cache hit không gọi provider, slug giữ, published/Telegram=0. Tổng 8 mock HTTP calls ở test gồm3 generation backlog; usage/cost là số giả chỉ kiểm tra kế toán, không cộng vào cost thực. Hai CLI import/process-pending dry-run chạy exit0 trên DB tạm.

**Test nền sửa đúng mismatch:** Lần đầu `test:news` 13 pass/2 fail vì assertion13 nguồn cũ sau T3 catalog thực tạo28. Đổi sang union tên legacy/catalog thay vì hardcode28, kiểm tra tất cả mới disabled và giữ override. Không đổi seed/config để ép số13. Sau sửa22/22, thêm integration cuối23/23.

**Build:** `scripts/check-news-build.ts` / `check:build:news` copy source/config/package chọn lọc, không `.env` hoặc DB thật, dùng module links và copy nguyên trạng Geist, production webpack build trên sandbox cùng ổD, DB tạm áp9migrations; cleanup finally. Harness ban đầu lỗi optional next-env/type environment, rồi font/junction cross-drive resolve; font thực có và import app giống baseline, không sửa UI/framework/dependency. Sửa harness đặt Geist physical và sandbox cùng drive; lần cuối compile12,2s, typecheck5,6s, 36/36 static pages pass. Có warning multiple lockfiles/root inference do sandbox dưới repo; không nghiệm thu tracing/package deploy/Turbopack/container từ build này.

| Lệnh | Exit | Kết quả |
|---|---|---|
| `npm.cmd run evaluate:news -- --mode offline --write-reports` (lần đầu và rerun) | 2 | Harness chạy xong; exit2 cố ý vì quality/live/human/shadow gates chưa đạt, không phải pass. Reports baseline/after/JSON đã sinh. |
| `npm.cmd run test:news` cuối | 0 | 23/23 pass, DB fixture absolute/relative + processing temp; toàn bộ schema9migrations áp trên DB tạm. |
| `npm.cmd run lint` | 0 | Lần đầu warning unused destructuring, đã sửa; lần sau sạch. |
| `npx.cmd --no-install tsc --noEmit --incremental false` | 0 | Lần đầu thêm build harness bắt ProcessEnv type, đã sửa và rerun pass. |
| `npm.cmd run check:build:news` cuối | 0 | Next16.2.6 webpack production trong sandbox, không `.env`/DB thật; 36/36 trang. |

**Bảo toàn:** Hai DB thật giữ SHA-256 baseline: `prisma/dev.db=cd77ead673daa29fa41f67b50f0fa9dd284105f648dd8a7800e4d728a61b8b35`, `dev.db=fcdb38fb960dbe55b65b3560172c54c97e744c03277a84c64f04b971d4ab9df3`; lockfile `a15fe0e3402216c56db91d2d68b4558f4a1e7f088186561cf8f3466650906739` không đổi trongT9. CLI evaluator đọc hash trước/sau và fail nếu đổi. Kiểm tra hash/diff cuối được ghi nối tiếp khi hoàn tất. Không migration/backfill/seed/import DB thật, không bật nguồn/AI/auto-publish/scheduler, không sửa `.env`.

**Kiểm tra cuối T9:** `test:news`23/23 exit0 (15,65s), lint exit0 sạch, tsc exit0, `git diff --check`exit0 chỉ cảnh báo LF/CRLF. Editor không báo lỗi fileT9 tại thời điểm kiểm tra. Node đọc hash cuối xác nhận hai DB và lockfile đúng các SHA-256 đã ghi trên; không revert thay đổi DB đã có từ đầu, không sửa nguồn/config thật. Sandbox build/temp DB đã cleanup, không có server/scheduler được bật.

**Live/cổng còn thiếu:** 0 call AI thật / usage0 / USD0; không có attempt unknown thật (unknown trong test là fixture). Live outputs0/100, human-reviewed0/30, shadow0/3, probe nguồn0, Telegram0. Không thực thi Docker/HTTP/browser/security acceptance/crash recovery toàn phần. T9 OFFLINE EXECUTED / GATES NOT MET, không DONE hoặc rollout. Các dependency T1–T8 chỉ được kiểm chứng một phần bởi test này.

**Bước tiếp theo cụ thể:** Biên tập viên duyệt nhãn và thu thập mẫu có nguồn thật theo từng loại, tạo calibration/holdoutv2 stratified mới (có important tiếng Việt). Từ calibration sửa lexical recall/technical signals và đánh giá lại không dùng v1 holdout để tune; sau đó chỉ khi người vận hành chấp thuận budget/live mới chạy >=100 outputs, human>=30 và 3 shadow crawl với auto-publish/Telegram tắt. Docker và API/security acceptance trên DB tạm vẫn cần riêng trước production migration.

### Mẫu ghi cuối mỗi phiên

```text
Ngày / phiên:
Task và checkbox đã hoàn thành:
File đã thay đổi:
Migration/backfill và DB đã dùng:
Lệnh kiểm tra + exit code + kết quả:
Nguồn live đã xác minh + báo cáo:
Số lần gọi AI thật / usage / chi phí known và unknown:
Phần chưa kiểm chứng / blocker:
Quyết định khác kế hoạch + lý do:
Bước đầu tiên cụ thể cho phiên tiếp theo:
```

### Nhật ký 2026-10-30 — T0: Baseline và DB kiểm thử độc lập

**Task và checkbox:** Hoàn thành bốn checkbox T0, chưa triển khai T1–T9. Đã đọc toàn bộ kế hoạch, `AGENTS.md` và hướng dẫn Next.js cài trong `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`, `01-app/03-api-reference/05-config/03-eslint.md` trước khi sửa code.

**Git đầu phiên:** `main...origin/main`; `prisma/dev.db` đã modified; `docs/`, `get-docker.sh`, `logs/` đã untracked. Giữ nguyên thay đổi có sẵn; không reset, commit hoặc push. File kế hoạch này thuộc `docs/` chưa được Git theo dõi từ đầu phiên.

**Baseline dữ liệu thật, chỉ SELECT với SQLite readonly:**

| Hạng mục | Kết quả |
|---|---|
| DB legacy | `prisma/dev.db`, có 6 bảng ứng dụng và `_prisma_migrations` |
| Nguồn | 13 enabled, 0 disabled: 10 rss, 1 github, 1 hackernews, 1 reddit |
| Health | Chưa có cơ chế T2; không suy ra healthy từ enabled; không probe live |
| Bài | 3.060 tổng: pending 633, published 115, rejected 2.312, draft 0 |
| Ngưỡng | `publish_threshold=75`, `pending_threshold=60`, `min_score_to_publish=75` |
| Giới hạn | `max_publish_per_crawl=10`, `max_repo_radar_ai_per_crawl=10` |
| Cờ AI đã có | translation=true, importance_reason=true, allow_publish_without_ai=false; chỉ đọc, không đổi hoặc kích hoạt |
| Lịch trong DB | `cron_schedule=0 6 * * *`; không khởi chạy scheduler trong phiên |
| `dev.db` ở root | Có schema nhưng Source/Article/AppSetting rỗng; giữ nguyên, không chọn làm DB legacy |

**Entrypoint đối chiếu bằng code, không chạy crawl thật:** `npm run crawl`/`cron:crawl` → `scripts/cron-crawl.ts` → `runCrawlPipeline`; `scripts/run-crawl.ts`, API `/api/crawl/trigger`, `/api/cron/crawl` cũng gọi cùng pipeline. `src/crawlers/index.ts::runAllCrawlers` là adapter tới pipeline; scheduler gọi adapter nhưng chưa tìm thấy caller của `startScheduler`, nên không xác nhận scheduler thật đang chạy. `scripts/crawl-direct.ts` là CLI chẩn đoán RSS/Reddit trực tiếp, không phải pipeline chính.

**Môi trường và lỗi nền:** Node 24.15.0 / Windows. Lockfile và dependency khớp: Next 16.2.6, React 19.2.4, Prisma/client/adapter 7.8.0, better-sqlite3 12.10.0, tsx 4.22.1, ESLint 9.39.4. Dependency đầu phiên có esbuild Linux nên test chưa vào logic; khôi phục bằng `npm ci`, rồi `prisma generate` với URL tạm để sinh lại client. Không đổi phiên bản/lockfile. Npm báo 24 vulnerability (2 low, 4 moderate, 17 high, 1 critical); chưa phân tích hoặc tự audit fix. `rg` không có; dùng tìm kiếm editor. PowerShell đôi lúc lỗi PSReadLine/khóa chia sẻ khi hash, Node đọc readonly thành công. Không coi các lỗi môi trường là lỗi logic; lint baseline sau phục hồi dependency pass.

**File và thay đổi:**

- Tạo `src/lib/databaseUrl.ts`: resolver dùng chung, relative từ project root; mặc định `prisma/dev.db`; hỗ trợ Windows absolute/backslash/file URL, POSIX, khoảng trắng. `file:./dev.db` ánh xạ rõ tới `prisma/dev.db` kèm cảnh báo chuyển sang `file:./prisma/dev.db`. Không âm thầm dùng DB rỗng ở root; từ chối URL sai hoặc query/fragment.
- Sửa `src/lib/prisma.ts`, `prisma.config.ts`, `prisma/seed.ts`: cùng tôn trọng `DATABASE_URL`; seed trực tiếp nạp dotenv, nhưng test không nạp `.env` thật. Seed chỉ tạo nguồn chưa có, giữ enabled/URL/type/config của nguồn đã tồn tại và setting đã chỉnh.
- Sửa thêm `scripts/crawl-direct.ts` dùng client chung vì còn hardcode DB riêng; đây là phần mở rộng tối thiểu của T0 để CLI chẩn đoán không bỏ qua URL test.
- Thêm `tests/helpers/testDatabase.ts`, `tests/news/database.test.ts`, script `test:news` trong `package.json`. Child process chỉ kế thừa allowlist biến OS, URL DB fixture, AI tắt và dotenv path không tồn tại. Test runtime/seed trực tiếp/chẩn đoán chặn fetch/HTTP/TCP; crawler chẩn đoán mock trả danh sách rỗng. Không gọi provider AI trong test DB.

**Migration/backfill và DB test:** Không đổi schema, không migrate/backfill/seed DB thật. Hai DB fixture riêng có tên chứa khoảng trắng, một ở OS temp (URL absolute), một trong thư mục tạm dưới `prisma/` (URL relative từ project root). Mỗi DB áp ba migration hiện có bằng CLI, seed qua CLI hai lần và seed trực tiếp từ CWD khác; cleanup trong `finally`. Một bài fixture published chỉ ở DB tạm để kiểm tra giữ slug/status, không xuất bản production. URL fixture dùng `.invalid`.

**Lệnh kiểm tra và bằng chứng:**

| Lệnh / kiểm tra | Exit code | Kết quả |
|---|---|---|
| Test đầu trước phục hồi dependency | 1 | Blocked do esbuild Linux trên Windows, chưa chạy logic |
| `npm ci` với biến DB tạm và dotenv path rỗng | 0 | Khôi phục dependency; hash lockfile không đổi |
| `npx --no-install prisma generate` với biến DB tạm | 0 | Sinh client 7.8.0, không chạy migration |
| `npm run test:news` trước sửa runtime | 1 | Đỏ đúng nguyên nhân: mở `<temp>/prisma/dev.db`, không phải `<temp>/news test.db` |
| Test sau thêm case POSIX | 1 | 12 pass / 3 fail; phát hiện path POSIX phụ thuộc Windows, sửa `path.posix` rồi chạy lại |
| `npm run test:news` cuối | 0 | 15/15 pass: resolver/legacy warning/fail-closed config, runtime, CLI migration, seed lặp, giữ cấu hình/setting/slug, CLI chẩn đoán mock, không tạo DB default thứ hai |
| `npm run lint` baseline và sau thay đổi | 0 | Pass |
| `npx --no-install tsc --noEmit --incremental false` | 0 | Pass; lỗi mới của helper thiếu `NODE_ENV` theo kiểu Next.js đã sửa, không gán là lỗi baseline |
| `git diff --check` | 0 | Không có whitespace error; chỉ cảnh báo LF/CRLF theo cấu hình Git hiện có |

**Bảo toàn dữ liệu:** Hash SHA-256 trước/sau giống nhau: `prisma/dev.db = cd77ead673daa29fa41f67b50f0fa9dd284105f648dd8a7800e4d728a61b8b35`; `dev.db = fcdb38fb960dbe55b65b3560172c54c97e744c03277a84c64f04b971d4ab9df3`; `package-lock.json = 2534277e7503ecd7b8fdcf1c26a579ea06758347b17443280ceb095506d6596f`. Không sửa `.env`, không in secret, không bật nguồn/AI đã tắt, không khởi chạy lịch.

**Live và chi phí:** 0 nguồn live xác minh; 0 call AI thật, usage/cost 0, không có attempt chi phí unknown; 0 Telegram thật. Không triển khai production. Không dùng mock chứng minh chất lượng AI hoặc sức khỏe nguồn.

**Chưa kiểm chứng:** Chưa chạy `npm run build`, HTTP workflow, Docker CLI, crawler/AI/Telegram live; case POSIX chỉ kiểm tra resolver trên Windows, chưa chạy container Linux. Chưa chứng minh cron thật được gọi; chưa xử lý vulnerability npm. Không dùng typecheck để kết luận production build pass; T0 không hàm ý toàn pipeline đã nghiệm thu.

**Khác kế hoạch:** Bảo vệ nguồn khi seed sớm ngay T0 để giữ config theo yêu cầu và sửa CLI chẩn đoán hardcode. T2 vẫn phải test catalog/import/stable catalogId riêng, chưa đánh dấu phần đó hoàn thành.

**Bước đầu tiên phiên tiếp theo:** T1 đã đủ dependency T0. Đọc lại mục 8 và code dedupe hiện hành, viết regression hai bài khác URL cùng feed qua hai lượt crawl trên DB tạm, xác nhận fail đúng nguyên nhân trước sửa. Không migration/backfill identity trên DB thật; dùng bản sao/DB tạm và báo collision trước unique constraint.

### Nhật ký 2026-10-30 — T1: Triển khai mã, bỏ qua test theo yêu cầu

**Yêu cầu phiên:** Người dùng: "bắt đầu T1, bỏ qua các bước test". Không tạo test T1, không chạy `test:news`, `test:api`, fixture hoặc crawl thử. Các kết quả 15/15 ở nhật ký T0 là lịch sử trước T1, không phải bằng chứng cho thay đổi T1. Chỉ cập nhật assertion migration của test T0 từ số 3 hardcode sang danh sách thư mục migration hiện có để không cố ý làm test nền sai; chưa chạy lại test này.

**Git/dữ liệu:** Tiếp tục trên worktree có thay đổi T0, DB modified và các mục untracked từ trước; không reset/commit/push. Hash hai DB và lockfile vẫn bằng baseline T0. Không sửa `.env`, không migrate/seed/backfill DB thật, không bật config/nguồn hoặc AI.

**Mã đã triển khai:**

- `src/lib/news/types.ts`: export các hợp đồng chuẩn mục 5; `identity.ts`: chỉ nhận URL HTTP(S) hợp lệ không chứa credentials, bỏ fragment/UTM/click tracking, giữ query ID có nghĩa và phân biệt path slash, sort query để có khóa ổn định. Identity là URL bài; thiếu URL dùng cặp sourceId/externalId; thiếu cả hai trả null. Fingerprint là SHA-256 nội dung gốc chuẩn hóa Unicode/whitespace, không phải khóa bài.
- `src/types/index.ts`, `src/crawlers/RSSCrawler.ts`: adapter thêm sourceId/GUID/originalText; giữ sourceUrl là feed và originalUrl gốc. `src/lib/utils.ts` bỏ hash 32-bit, canonical URL dùng chung resolver identity; title similarity không còn quyết định loại bài tự động.
- `prisma/schema.prisma`, migration `20261030090000_news_identity`: identity nullable unique; source/externalId, fingerprint, pendingFingerprint, contentChangedAt, identityReviewReason. Các cột thêm không đổi URL/slug/status, index chấp nhận nhiều NULL. Chưa áp migration.
- `src/lib/news/storeIdentity.ts`: xử lý P2002 trả owner đã tồn tại, retry slug riêng cho bài mới; lookup legacy chỉ theo originalUrl hoặc source/externalId và liên kết duplicate thay vì xóa. Bài thiếu identity/URL buộc pending. Cùng identity nhưng fingerprint đổi chỉ ghi cờ/review và fingerprint quan sát mới; không sửa title/nội dung/slug/status/publishedAt của bài cũ. Legacy thiếu fingerprint không suy ra nội dung gốc từ bản dịch, ghi lý do review.
- `src/lib/pipeline/crawlPipeline.ts`: bỏ feed/sourceUrl, content hash và title similarity khỏi exact dedupe; trong một lượt dùng identity, không dùng fingerprint để chọn nhầm các bài khác identity. Nội dung khác nhau cùng identity trong lượt bị gắn review; candidate không có URL/identity hợp lệ lưu pending, không gọi AI/tự publish. Conflict insert trả bài cũ không được tính là publish mới hoặc gửi Telegram lại. Không thay đổi logic hai cờ AI/budget thuộc T6/T7.
- `src/crawlers/BaseSourceCrawler.ts` và API admin publish Repo Radar dùng cùng đường lưu identity để không bypass unique conflict. API bài chỉ thêm cờ identity/review vào select admin; select public không đổi. Đã đọc hướng dẫn Next.js route handler hiện có trước sửa API.
- `scripts/prepare-news-identity.ts`: chỉ mở DB nguồn readonly, SQLite backup sang đường dẫn mới, xuất JSON collision report trước backfill và unique index; chọn owner ưu tiên published, giữ bài trùng và thêm duplicate link, fingerprint legacy để rỗng vì chưa có originalText đáng tin. Chỉ thay schema/backfill/ghi migration checksum trên bản sao; kiểm tra giữ id/slug/status trong transaction, không thay app settings/sources. Từ chối overwrite file hoặc chọn DB app làm output. Script chưa được chạy; chưa có báo cáo collision thực tế.

**Lệnh đã chạy, không phải behavioral test:** `prisma generate` với DATABASE_URL tạm và DOTENV_CONFIG_PATH không tồn tại (exit 0; sinh client 7.8.0, không mở/migrate DB), `npx --no-install tsc --noEmit --incremental false` (exit 0), `npm run lint` (exit 0). Hash readonly bằng Node khớp: `prisma/dev.db=cd77ead673daa29fa41f67b50f0fa9dd284105f648dd8a7800e4d728a61b8b35`, `dev.db=fcdb38fb960dbe55b65b3560172c54c97e744c03277a84c64f04b971d4ab9df3`, lockfile không đổi.

**Kiểm tra cuối:** Typecheck và lint đều exit 0 sau toàn bộ thay đổi; editor không báo lỗi liên quan ở các file sửa; `git diff --check` exit 0 (chỉ cảnh báo LF/CRLF). Không chạy bất kỳ test nào trong phiên T1.

**Giới hạn và lưu ý vận hành:** Chưa chứng minh hai lượt crawl, UTM/query ID, version/ngày khác, insert đồng thời, thay đổi fingerprint, migration/backfill/collision hoặc slug qua runtime. Không báo T1 DONE và không coi typecheck/lint là test hành vi. Chưa chạy build/Docker/HTTP/live AI. Không được chạy bản code Prisma mới trên DB schema cũ trước khi migration được kiểm chứng và được người vận hành chấp thuận áp dụng. Concurrent AI calls vẫn có thể xảy ra trước insert; lease/budget/exactly-once bên ngoài thuộc T7, không tuyên bố đã giải quyết ở T1.

**Công cụ dành cho bước kiểm chứng sau (CHƯA CHẠY):** `npx tsx scripts/prepare-news-identity.ts --source prisma/dev.db --copy <new-temp-directory>/news-identity.db --report <new-temp-directory>/news-identity-collisions.json`. Dùng đường dẫn output mới ngoài repo vì snapshot có thể chứa cấu hình nhạy cảm; không commit snapshot/report có dữ liệu nhạy cảm. Lệnh chỉ chuẩn bị bản sao, không thay DATABASE_URL/app config. Báo cáo được ghi trước transaction, nên khi lỗi phải xem log và không giả định snapshot đã hoàn tất.

**Live/chi phí:** 0 call AI thật / usage 0 / cost 0; không có attempt unknown, 0 Telegram, không xuất bản production, không xác minh nguồn live.

**Bước tiếp theo:** T1 vẫn là task đầu tiên chưa nghiệm thu. Khi được phép kiểm chứng lại, bổ sung regression identity và thử migration/backfill trên snapshot/DB tạm trước; xem collision report và xác nhận slug/status giữ nguyên. Không tự chuyển T2 chỉ vì mã T1 đã compile.

### Nhật ký 2026-10-30 — T2–T5: Triển khai mã, không chạy test

**Yêu cầu phiên:** Người dùng: "Triển khai T2, T3, T4, T5. Không cần test". Đây là chỉ đạo tiếp tục phần mã dù cổng nghiệm thu T1 chưa đạt, không phải bỏ yêu cầu bảo toàn DB hoặc tự cho phép production/live AI. Không tạo/chạy test, fixture, mock crawl hoặc test CLI trong phiên này. Các lần pass T0 trước đây không chứng minh T1–T5 hiện tại.

**T2/T3:** Thêm `src/lib/sources/{catalog,fetch,reader,health,importCatalog}.ts`; `ConfiguredSourceCrawler` dùng chung cho RSS, HN Algolia, Reddit, GitHub discovery, arXiv và GitHub Releases. URL/config được validate, GitHub credentials chỉ đến HTTPS api.github.com, DNS được kiểm tra mọi địa chỉ và pin kết nối. HTTP giới hạn 10s mặc định, 3 redirects, 2 MB nén/giải nén, 3 toàn cục/1 host trong process. 304 tách khỏi failed; lỗi parse giữ HTTP metadata; lỗi nguồn đi vào CrawlRun. Health/backoff không đổi enabled. ETag/Last-Modified chỉ checkpoint sau khi toàn bộ candidate đã lưu bền, không checkpoint lúc mới fetch hoặc probe. Config đổi trong lúc probe thì bỏ kết quả ghi verification.

Catalog có stable ID, publisher/kind/language/discovery và 19 endpoint ứng viên. Import không ghi đè URL/config/enabled, chỉ gắn metadata trống và tạo mới disabled/unverified. Seed nguồn legacy cũng chỉ tạo nguồn mới disabled, giữ nguồn đã tồn tại và toàn bộ settings cũ. CLI `sources:import -- --dry-run` dùng SQLite readonly/fileMustExist, đọc được cả schema legacy; probe CLI hỗ trợ `--catalog-id`, `--all`, `--dry-run` và không gọi AI. Probe dry-run gọi mạng nhưng không mở Prisma/ghi DB; probe persisted dùng URL/config đã lưu. Không CLI nào được chạy trong phiên.

arXiv: đã đọc manual/terms, abstract metadata, 4 cs.* categories, max 20, lookback 7 ngày, cadence ngày, 3.1s và một kết nối/process; giữ ID/version và base event. GitHub Releases: đọc API docs, adapter giữ ID/tag, bỏ draft, prerelease cần review; probe có bước kiểm tra repository full_name bằng API trước. Chưa xác minh owner/repo live. Admin sources có health/lỗi/backoff, probe được auth guard, mẫu bài và config JSON; nguồn mới không thể enable trước verified; sửa URL/config thì disabled và reset verification/cache. Không thay trạng thái nguồn trong DB thật.

**T4:** `news/normalize.ts`, `news/enrich.ts`, schema evidence và pipeline lưu riêng originalTitle/text/language/evidence/date. Cheerio bỏ script/style/navigation và chuẩn hóa entities/whitespace; kiểm tra nội dung độc lập title, ít nhất 160 ký tự có ý nghĩa cùng từ vựng đủ đa dạng. Không dùng gate 80 ký tự. Title-only/short giữ pending; ngày thiếu/sai/tương lai >24h/quá 30 ngày gắn review; không gán ngày fetch vào ngày bài. HN/Reddit thiếu evidence thử đọc article/description một lần/canonical URL/lượt qua safe HTTP, không JS/paywall bypass; lỗi vẫn pending. Bản dịch mới không lấy raw English làm summaryVi/contentVi. Đường save legacy chỉ pending và dùng cùng chuẩn metadata, không bypass publication gate.

**T5:** `news/rank.ts` dùng clock, thành phần đúng khoảng điểm, `news-rank-v1` và breakdown JSON; scorer cũ trở thành adapter, bỏ bonus version model hardcode/global-regex state. Nguồn chính thức được ghi là vendor claim, không coi là xác nhận độc lập. `news/categories.ts` tách helper nhẹ; aliases đọc tool-release/industry/breakthrough, không rewrite bài published. Pipeline chọn tối đa 10, 2/publisher, 3 community và lưu mọi candidate chưa chọn pending với reason threshold/quota/budget. Settings được parse/clamp lúc đọc, không ghi đè DB. Repo Radar dùng safe HTTP và phần ngân sách bài AI còn lại; topic discovery riêng, retry/lease/usage bền vững vẫn thuộc T7. Cluster lưu suggestion/links trong DB, cửa sổ 72h, event/version/day và product variant/CVE; trường hợp không đủ định danh lưu review riêng, không xóa/merge bài. UI/API admin có evidence/score/reason, metadata mới không thêm vào public selects.

**Schema/migration:** Thêm ba migration additive `20261030100000_source_health`, `20261030101000_news_evidence`, `20261030102000_news_ranking` cùng index event/date. Chỉ sinh Prisma client, không chạy bất kỳ migration/seed/backfill/import nào. T1 identity migration cũng chưa áp. Không dùng client/schema mới chạy app trên DB cũ trước khi migration được kiểm chứng/chấp thuận riêng.

**Kiểm tra đã chạy (không phải behavioral test):**

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd install ipaddr.js cheerio` | Exit 0; thêm thư viện IP/parser và cập nhật lockfile có chủ đích. npm báo 24 vulnerability, chưa audit fix. |
| `prisma generate` với DATABASE_URL tạm không dùng, DOTENV_CONFIG_PATH không tồn tại | Exit 0, Prisma 7.8.0; lần cuối 88ms. Không mở/migrate DB ứng dụng. |
| `npx.cmd --no-install tsc --noEmit --incremental false` sau từng nhóm sửa | Pass ở lần cuối. Đã bắt/sửa custom Atom id thiếu kiểu và dấu chấm phẩy trong nhánh cluster; không giấu lỗi ban đầu như baseline. |
| `npm.cmd run lint` | Exit 0 sau các phần mã chính; kiểm tra cuối sau nhật ký được ghi riêng bên dưới. |
| Editor diagnostics | Không báo lỗi ở pipeline, admin nguồn/bài và CLI mới tại thời điểm kiểm tra. |
| Review tĩnh read-only | Sửa checkpoint ETag trước persistence, giữ HTTP metadata khi parse lỗi, không cho invalid link chiếm chỗ valid item và bổ sung product variant/CVE cho cluster. Không dùng review thay cho runtime test. |

**Bảo toàn dữ liệu:** Hash cuối `prisma/dev.db=cd77ead673daa29fa41f67b50f0fa9dd284105f648dd8a7800e4d728a61b8b35`, `dev.db=fcdb38fb960dbe55b65b3560172c54c97e744c03277a84c64f04b971d4ab9df3`, khớp baseline T0/T1. Lockfile thay đổi do hai dependency mới, không tuyên bố bất biến. Không sửa `.env`, không revert thay đổi có sẵn; không commit/push. `prisma/dev.db` vẫn hiện modified trong Git như đầu phiên, không phải do phiên này ghi DB.

**Live/chi phí:** 0 nguồn probe live; 0 AI call thật / usage 0 / cost 0; không có attempt unknown; 0 Telegram; không publish/deploy production hoặc chạy scheduler. Chỉ fetch trang tài liệu nhà cung cấp, không dùng chúng làm bằng chứng feed parse thành công. Báo cáo nguồn: `docs/reports/source-validation-2026-10-30.md`.

**Chưa kiểm chứng:** SQL migration/backfill/collision, seed/import lặp, SSRF/DNS/redirect/decompression/concurrency, HTTP 304 checkpoint, ranking/quotas/cluster, nội dung/ngày/tiếng Việt qua runtime, HTTP/UI/browser, build và Docker. Không khởi chạy server vì schema DB thật chưa migrate và không được phép nghiệm thu runtime trong phiên. Rate/concurrency guards hiện process-local; không chạy arXiv CLI/server chồng nhau hoặc nhiều máy trước khi có điều phối phù hợp. Hàng chờ retry/lease/AI schema/quality/usage vẫn thuộc T6/T7, không tuyên bố đã có. Không mark DONE hoặc tự bật nguồn để đủ số.

**Bước tiếp theo:** Khi cho phép nghiệm thu, xác minh T1 và ba migration mới trên snapshot/DB tạm trước, giữ collision report/slug/status/settings; cập nhật test baseline theo chính sách seed/catalog mới rồi chạy các regression T1–T5. Sau đó probe một catalog ID có giới hạn bằng `--dry-run`, ghi evidence live vào báo cáo, chỉ enable qua admin sau xác minh và phê duyệt. T6/T7 chưa được triển khai trong phiên này.

**Kết quả kiểm tra cuối phiên:** `npx.cmd --no-install tsc --noEmit --incremental false`, `npm.cmd run lint`, `git diff --check` đều exit 0 sau toàn bộ mã T2–T5; diff chỉ cảnh báo LF/CRLF theo cấu hình Git. Editor không báo lỗi ở pipeline, fetch/reader, cluster và hai trang admin đã sửa. Không có test hay runtime acceptance bổ sung. Tất cả trạng thái vẫn IMPLEMENTED / UNVERIFIED, không chuyển DONE.

### Nhật ký 2026-10-30 — T6–T8: Triển khai mã, không chạy test

**Yêu cầu phiên:** Người dùng: "Tiếp tục chạy đến T8, vẫn không yêu cầu test". Triển khai T6–T8 dù các cổng T1–T5 còn unverified; không tạo/chạy tests, fixtures/mock run, migration/seed/backfill/import/probe/crawl/pending dry-run, AI/Telegram hay container acceptance. Không dùng kết quả 15/15 lịch sử T0 chứng minh mã hiện tại.

**T6:** Thêm ai/schema.ts, prompts.ts, quality.ts; thay OpenRouter transport bằng local runtime validation trong từng attempt, independent flags, max 3 model/6 call, 30s/call/120s network deadline, bounded jitter/backoff/Retry-After và terminal config/refusal. Structured input dùng evidence source-1; không nhận citation URL mới làm chứng cứ. Thêm AiAttempt trace article/repo, actual model/provider/request/latency/tokens/cost nullable và phiên bản. Chỉ đọc tài liệu OpenRouter structured outputs/Chat Completions/errors, không gọi provider/model/pricing API. JSON mode được chọn thay vì giả định strict schema capability. Quality kiểm tra bảo thủ số/model/entity phổ biến/URL/evidence ID/rumor/instruction/uncertainty; không chứng minh semantic entailment hoặc factual accuracy, cần human review T9.

**T7:** Thêm ai/budget.ts, pipeline/processPending.ts và scripts/process-pending.ts. Mọi bài được lưu trước AI; dedupe không làm mất bài queued cũ. Worker quét toàn backlog đến hạn, score theo clock mới/quota, conditional claim/5-minute lease/batch lease, heartbeat trước attempt; write chỉ khi owner/lease/input còn hợp lệ. Cache có input/flags/prompt/schema; admin/source changes thu hồi lease, cache hỏng review; expired attempt-limit chuyển failed. Lỗi tạm có lịch, cấu hình/evidence/refusal/schema chờ người vận hành, không hot retry. Trần 10 bài AI/10 repo AI độc lập nhưng chung USD budget; publish max min(10, setting). Dry-run mở SQLite readonly/fileMustExist, chỉ chọn và estimate upper bound; không Prisma query/write, lease/reservation/AI/Telegram. Chưa thực thi CLI.

Budget fail-closed cần explicit enable, operator daily USD/token limits và verifiedAt/input-output prices cho model ID cụ thể; không có giá mặc định hoặc `auto`/`:free` routing trong price table. Reserve atomic bằng micro-USD trước từng call, settle provider cost hoặc usage/bảng giá đúng actual model. Cost không biết giữ reservation, crash/unsettled không refund. UI tách known/unknown/unsettled; ngày UTC. Bảng giá do operator tự kiểm chứng với endpoint/provider; nếu actual cost vượt estimate vì giá sai, vẫn ghi actual và chặn các attempt sau. Không có exactly-once external call: crash sau gửi có thể lặp generation sau lease expiry, reservation cũ tiếp tục được giữ. Không tự reconcile/refund reservation chưa biết chi phí.

**T8:** Admin sources có publisher/kind/language và last fetch 304/error/stale; articles có original/AI cạnh nhau, evidence/claims/uncertainties/score, queue/retry, 20 trace và 10 audit gần nhất (admin only). API reprocess enqueue có reason/optional cache invalidation; không reprocess bài published hoặc identity/content chưa giải quyết. Article approve/reject/edit và settings/repo edits có optimistic CAS/audit, approve ngoại lệ cần xác nhận+lý do; không đổi slug. Repo discovery publish không giả ngày release hoặc fallback English thành bản tin VI, lưu pending trước approve/audit. AI preview không dùng bài mẫu, cần confirmPaidRequest/evidence và budget/audit. Public selects không thêm queue/trace/raw source/usage/cost; chưa chứng minh HTTP isolation bằng test.

Analytics/stats hiển thị UTC budget known/reserved/unknown/unsettled, backlog age/status, lỗi source/model và coverage nhóm nguồn. Settings validate toàn request trước transaction, không ghi nửa chừng. Pending cron có helper đọc enable/schedule/limit từng tick, node-cron UTC và checkpoint DB; app scheduler/system cron dùng chung helper, CLI trực tiếp vẫn chủ động và chịu AI/budget flags. Không khởi chạy scheduler trong phiên. README có lệnh CLI/lịch/env, unknown/cost/crash và giới hạn nghiệm thu. Seed chỉ tạo các khóa mới còn thiếu; chưa chạy lại để chứng minh override với schema mới.

Docker giữ package-lock.json trong context, npm ci, copy src/scripts/tsconfig/prisma.config/next.config; build migration DB ở /tmp không được copy vào runner. Entrypoint tôn trọng DATABASE_URL/resolver T0, không tự migrate/seed hoặc chmod world-writable, custom DB directory permissions do operator quản lý. Không chạy build hoặc container; không dùng code Docker làm bằng chứng CLI Linux hoạt động.

**Schema:** Thêm hai migration additive 20261030110000_ai_processing_trace và 20261030111000_pending_budget_audit: trace, queue/lease/cache/budget/audit/checkpoint và repo retry fields. Legacy processing default review, giữ nội dung/status/slug hiện có. Prisma generate với URL OS temp không dùng + dotenv path không tồn tại pass; không mở/migrate DB ứng dụng. Các migration T1–T8 đều chưa được nghiệm thu/áp trên DB thật; tuyệt đối không chạy app client mới trên schema cũ trước phê duyệt riêng.

**Kiểm tra đã chạy:** npx.cmd --no-install tsc --noEmit --incremental false sau từng nhóm sửa đều pass; npm.cmd run lint pass; editor diagnostics sạch ở các module/route/admin đã kiểm tra. Rà static đã sửa state processing mất lease do admin edit, flag-sensitive cache/disabled fields, scan cap gây starvation, và số đếm pending/AI logs. Đây không phải behavioral/concurrency/cost/quality test. Kiểm tra cuối phiên và hash ghi tiếp bên dưới sau khi hoàn tất tài liệu.

**Live/chi phí và bảo toàn:** 0 call provider AI, 0 usage/cost thực, không có attempt unknown phát sinh trong phiên; 0 source live probe, 0 Telegram, không publish/deploy production. Không sửa .env hoặc setting/nguồn trong DB; giữ worktree dirty có sẵn, không commit/push. package scripts thay đổi có chủ đích; không thêm dependency mới ở T6–T8. Npm 24 vulnerability từ trước chưa xử lý.

**Kết quả cuối phiên:** Prisma generate và validate với DATABASE_URL tạm không dùng/DOTENV_CONFIG_PATH không tồn tại đều exit 0; schema hợp lệ, không migrate DB. TypeScript noEmit/incremental false, npm.cmd run lint và git diff --check đều exit 0 sau toàn bộ mã; chỉ có cảnh báo LF/CRLF của Git. Editor không báo lỗi liên quan ở các module/route/admin/CLI đã kiểm tra. Rà cuối bổ sung callsMade để budget hết giữa fallback không xóa chu kỳ generation đã gửi call, đồng thời giới hạn pending cron năm field/phút. Tất cả là kiểm tra tĩnh, không phải test hành vi.

Hash readonly cuối khớp baseline: prisma/dev.db = cd77ead673daa29fa41f67b50f0fa9dd284105f648dd8a7800e4d728a61b8b35; dev.db = fcdb38fb960dbe55b65b3560172c54c97e744c03277a84c64f04b971d4ab9df3. package-lock.json = a15fe0e3402216c56db91d2d68b4558f4a1e7f088186561cf8f3466650906739, giữ nguyên từ cuối T2–T5. File DB vẫn hiện modified trong Git như trước phiên, không phải do phiên này ghi dữ liệu.

**Chưa kiểm chứng / khác kế hoạch:** Không có test mới hoặc chạy test theo yêu cầu. Chưa chạy migration/seed/lặp seed, two-worker/crash/atomic budget, readonly CLI, HTTP auth/public isolation, browser responsive, actual translation/factual accuracy, timings/provider errors, build/Docker/Linux/cron. Delay list có 2h nhưng max 3 chu kỳ khiến lỗi cuối terminal, không có chu kỳ thứ 4. Scan toàn backlog bảo đảm không bị cắt 1.000 bài nhưng cần benchmark dung lượng/thời gian T9. HTTP source pacing/semaphore vẫn process-local, chưa điều phối arXiv đa máy. Human approval ngoại lệ được audit, không được hiểu là auto quality gate pass. T6–T8 không DONE và không đủ điều kiện rollout.

**Bước tiếp theo cụ thể:** Khi cho phép kiểm chứng, bắt đầu từ migration/identity snapshot và collision report T1 trên DB tạm, xác nhận slug/status/settings giữ nguyên; sau đó bổ sung/rerun regression T1–T8 (mock provider, concurrency/unknown-budget, HTTP auth/public isolation), build và container CLI với DB dùng một lần. Chỉ sau các cổng này mới làm T9 benchmark/human review/shadow với ngân sách được phê duyệt; không tự bật AI/publish/Telegram để lấy bằng chứng.

### Prompt dùng để giao việc cho phiên sau

> Đọc `AGENTS.md` và toàn bộ `docs/superpowers/plans/2026-10-30-news-quality-ai-sources.md`. Kiểm tra trạng thái repository, rồi thực hiện task đầu tiên chưa hoàn tất và đủ dependency. Giữ dữ liệu/config hiện có, dùng DB tạm và mock AI cho test. Hoàn thành một task có thể kiểm chứng, cập nhật checkbox/bảng tiến độ/nhật ký vào chính file kế hoạch. Không tự bật AI trả phí, xuất bản production hoặc gửi Telegram thật. Báo rõ kết quả kiểm thử, phần chưa kiểm chứng và bước tiếp theo.
