# Source Validation Inventory - 2026-10-30

## Status

Implementation inventory only. No live feed/API probe was executed in this session because the user requested implementation without tests. Documentation retrieval is not evidence that a source endpoint is healthy. All new catalog entries are unverified and import as disabled. Existing admin enabled/URL/config values are preserved.

No source was enabled, no catalog was imported, no migration/seed/crawl was executed, and no AI/Telegram call was made. The pre-change readonly baseline was 13 enabled sources, not 13 confirmed healthy sources. The goals of 8 new independent publishers, 20 enabled + healthy sources and 2 working Vietnamese sources remain UNVERIFIED.

## Candidate Catalog

| Catalog ID | Publisher / Kind | Language | Endpoint / Discovery | Live Result |
|---|---|---|---|---|
| openai-blog | openai / official | en | https://openai.com/blog/rss.xml ; https://openai.com/news/ | Not probed |
| google-ai | google / official | en | https://blog.google/technology/ai/rss/ ; https://blog.google/technology/ai/ | Not probed |
| deepmind-blog | google / research | en | https://deepmind.google/blog/rss.xml ; https://deepmind.google/blog/ | Not probed |
| huggingface-blog | huggingface / engineering | en | https://huggingface.co/blog/feed.xml ; https://huggingface.co/blog | Not probed |
| nvidia-developer | nvidia / engineering | en | https://developer.nvidia.com/blog/feed/ ; https://www.nvidia.com/en-us/about-nvidia/rss/ | Not probed |
| microsoft-research | microsoft / research | en | https://www.microsoft.com/en-us/research/feed/ ; https://www.microsoft.com/en-us/research/blog/ | Not probed |
| aws-machine-learning | amazon / engineering | en | https://aws.amazon.com/blogs/machine-learning/feed/ ; https://aws.amazon.com/blogs/machine-learning/ | Not probed |
| google-research | google / research | en | https://research.google/blog/rss/ ; https://research.google/blog/ | Not probed |
| techcrunch-ai | techcrunch / media | en | https://techcrunch.com/category/artificial-intelligence/feed/ ; https://techcrunch.com/category/artificial-intelligence/ | Not probed |
| ars-technica | ars-technica / media | en | https://feeds.arstechnica.com/arstechnica/index ; https://arstechnica.com/ | Not probed; AI filter required |
| vnexpress-so-hoa | vnexpress / media | vi | https://vnexpress.net/rss/so-hoa.rss ; https://vnexpress.net/rss | Not probed; AI filter required |
| vietnamnet-cong-nghe | vietnamnet / media | vi | https://vietnamnet.vn/rss/cong-nghe.rss ; https://vietnamnet.vn/ | Not probed; AI filter required |
| arxiv-cs-ai / arxiv-cs-cl / arxiv-cs-lg / arxiv-cs-cv | arxiv / research | en | https://export.arxiv.org/api/query ; https://info.arxiv.org/help/api/index.html | Not probed; four categories are one publisher |
| github-releases-vllm-project-vllm | vllm-project / engineering | en | https://api.github.com/repos/vllm-project/vllm/releases ; https://github.com/vllm-project/vllm/releases | Owner/repo not live-verified |
| github-releases-huggingface-transformers | huggingface / engineering | en | https://api.github.com/repos/huggingface/transformers/releases ; https://github.com/huggingface/transformers/releases | Owner/repo not live-verified |
| github-releases-ggml-org-llama.cpp | ggml-org / engineering | en | https://api.github.com/repos/ggml-org/llama.cpp/releases ; https://github.com/ggml-org/llama.cpp/releases | Owner/repo not live-verified |

19 candidate endpoints, not 19 independent publishers or working sources. Legacy sources that overlap by catalog ID, name or exact URL are linked rather than overwritten. Guessed/unconfirmed feeds such as Anthropic/Meta are not added as verified sources.

## Policies Read

- arXiv manual: https://info.arxiv.org/help/api/user-manual.html
- arXiv terms: https://info.arxiv.org/help/api/tou.html
- GitHub release API: https://docs.github.com/en/rest/releases/releases

arXiv uses descriptive metadata/abstracts only, never PDFs. Default cadence is daily per category/query, one connection with at least 3.1 seconds between API requests, maximum 20 items/category and seven-day submitted-date lookback. ID + version is preserved; versions share a base event identity but are not deduplicated against each other.

GitHub release probe checks repository full_name with the repository API. Public reads do not require a token; optional auth uses an environment-variable reference and HTTPS api.github.com only. Drafts are excluded, prereleases require review. Release ID and tag are retained. GitHub API calls use per-host pacing, conditional requests and bounded Retry-After handling.

RSS and article permissions must be reviewed per publisher before enabling. No JavaScript rendering, CAPTCHA bypass, subscription bypass or paid intermediary is implemented. Enrichment avoids detected paywalls, but detection is best-effort and is not a license grant. Original text is admin-only; new public Vietnamese fields do not contain raw English.

## Operator Workflow (Not Executed)

First verify T1 identity preparation and all additive migrations on a disposable snapshot, preserve collision reports and article slugs/status, then approve migration of the actual application database separately. Do not start the new runtime on the old schema.

```powershell
npm.cmd run sources:import -- --dry-run
npm.cmd run sources:probe -- --catalog-id nvidia-developer --dry-run
```

Import dry-run opens the selected existing SQLite file readonly and never creates a missing database. Probe dry-run makes real network requests to the catalog candidates but never imports, opens Prisma, changes DB, enables sources or calls AI. It uses catalog URLs, not admin overrides. Run one bounded probe first; do not infer acceptance from the commands merely existing.

After migrations are approved and applied on the selected database:

```powershell
npm.cmd run sources:import
npm.cmd run sources:probe -- --catalog-id nvidia-developer
```

Persisted probes use the stored admin URL/config and update health/verification only. Admin must explicitly enable a verified source. Both probe modes support `--all` instead of `--catalog-id ID`. Capture final URL, HTTP/content-type, UTC timestamp, latency, samples, stale status and error code from probe output here before claiming live acceptance. Never include tokens, cookies or copyrighted full text.

## Remaining Verification

- DNS pinning, private/reserved IPv4/IPv6, redirects, timeout, decompression bounds and concurrent processes are statically implemented, not behavior-verified.
- Source health/backoff, idempotent imports, HTTP 304 checkpoints, missing dates, Vietnamese text, version identity, ranking quotas and cluster suggestions are not runtime-verified.
- Rate/concurrency guards are process-local. Concurrent CLI/server jobs require coordination in T7; do not run overlapping arXiv jobs across machines/processes.
- No HTTP/UI, browser, production build or Docker acceptance was performed. No paid AI was used. npm reports 24 vulnerabilities; no unrelated audit fix was applied.