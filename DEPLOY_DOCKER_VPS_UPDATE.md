# Deploy ban code moi len Docker VPS Linux

Cap nhat: 2026-10-30. Huong dan nang cap AI News hien tai bang Bash tren VPS Linux, Docker Engine va Docker Compose V2 (`docker compose`). Khong chay cac lenh Bash nay trong PowerShell Windows.

## 1. Trang thai va nguyen tac

- T9 offline: 23/23 test, lint, typecheck va production webpack build trong sandbox pass. Docker image/Turbopack/container tren Linux chua duoc nghiem thu trong phien do.
- Recall holdout synthetic moi 62,5%, chua dat 85%; chua co du 100 output AI live, 30 ban tin human review hay 3 shadow crawl. Deploy ky thuat thanh cong KHONG dong nghia duoc bat pipeline tu dong.
- Quy trinh nay co maintenance window, migrate BAN SAO DB, duyet du lieu roi chuyen sang ban sao. Khong migrate DB cu dang dung, khong seed/crawl/AI/Telegram that trong quy trinh nang cap.
- Doc het truoc khi chay. Moi block la mot buoc rieng; neu lenh loi, DUNG, khong chay block tiep.
- Khong `git reset --hard`, `git clean`, checkout DB, `docker compose down -v`, prune image/volume hoac xoa DB de khac phuc loi deploy.
- Production dung `prisma migrate deploy`. KHONG dung `npm run db:migrate`: script do la `prisma migrate dev`.

## 2. Secrets va dieu kien chuan bi

Neu secret da xuat hien trong chat/log/repo, xem nhu da lo. Thu hoi va cap lai OpenRouter API key, Telegram bot token, mat khau admin, cron secret. Khong dan secret vao tai lieu, Git, ticket hoac lenh shell co history; sua bang editor tren VPS.

`ENCRYPTION_KEY` dung giai ma settings DB va ky JWT. Khong doi key tuy y khi DB con settings encrypted: can backup, ke hoach giai ma/nhap lai settings va chuyen key co kiem soat; dang nhap lai sau khi doi. Giu key cu trong backup han che quyen de phuc hoi, khong in ra terminal/log.

Can Docker + Compose V2, Git, curl, sqlite3, du RAM/disk cho build va backups. Ubuntu/Debian co the cai sqlite3 bang `apt-get update` va `apt-get install -y sqlite3` voi quyen root. Can SSH du phong va phe duyet maintenance/migration tu nguoi van hanh.

Release phai chua day du src/scripts/schema/migrations/Dockerfile/lockfile/tsconfig/prisma.config/public va build config. Code chua commit o may local khong tu xuat hien khi `git pull` tren VPS. Khong upload `.env`, DB, node_modules Windows hay `.next` local de ghi de VPS.

Huong dan gia dinh Nginx chay tren HOST, proxy vao localhost:3000. Neu proxy chay container khac, can network/upstream rieng; localhost cua container proxy khong phai host VPS.

## 3. Khai bao duong dan, luu image/config cu

Chay bang root trong mot phien SSH (`sudo -i` neu can), thay `/opt/ai-news` cho dung. Khong `set -x`.

```bash
set -euo pipefail
umask 077
APP_DIR=/opt/ai-news
OLD_PROJECT_DIR="$APP_DIR"
STATE=/srv/ai-news
RELEASE=$(date -u +%Y%m%d-%H%M%S)
BACKUP="$STATE/backups/$RELEASE"
WORK="$STATE/staging/$RELEASE"
DATA="$STATE/data"
NEW_IMAGE="ai-news:$RELEASE"
OLD_IMAGE="ai-news:rollback-$RELEASE"

cd "$OLD_PROJECT_DIR"
docker version
docker compose version
sqlite3 --version
docker compose ps
docker inspect --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}' ai-news
OLD_PROJECT=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' ai-news)
test -n "$OLD_PROJECT"
mkdir -p "$BACKUP" "$WORK" "$DATA" "$STATE/logs"
chmod 700 "$STATE" "$BACKUP" "$WORK" "$DATA" "$STATE/logs"
docker tag "$(docker inspect --format '{{.Image}}' ai-news)" "$OLD_IMAGE"
printf '%s\n' "$OLD_IMAGE" > "$BACKUP/old-image.txt"
printf '%s\n' "$OLD_PROJECT" > "$BACKUP/old-project.txt"
printf '%s\n' "$OLD_PROJECT_DIR" > "$BACKUP/old-project-dir.txt"
cp -p .env "$BACKUP/app.env.original"
cp -p docker-compose.yml "$BACKUP/docker-compose.old.yml"
git rev-parse HEAD > "$BACKUP/old-code-ref.txt"
```

Xac nhan mount dung DB that. Vi du cu: container `ai-news`, service `ai-news`, DB trong container `/app/prisma/dev.db`. Neu ten/path khac, sua lenh ben duoi truoc. DB rong o root repo khong phai DB legacy can dung.

Neu Compose cu dung nhieu file override, luu tat ca va dung lai dung tap file/project khi stop/rollback; vi du o day ap dung repo mac dinh mot docker-compose.yml. Backup co config/du lieu nhay cam, khong commit/upload cong khai.

## 4. Dung writers va snapshot SQLite

Bat maintenance o reverse proxy: chan tat ca traffic vao app, ke ca admin/API/HTTP cron. Tam vo hieu job lien quan trong user/root crontab, `/etc/cron.d`, systemd timer, PM2, HTTP cron service ben ngoai. Ghi lai lich, khong tat tat ca cron cua VPS mot cach mu quang.

Cho crawl/worker ket thuc. Dung process khong dam bao request AI/Telegram ben ngoai chua duoc xu ly: neu co request dang do, phai doi soat chi phi/trang thai truoc.

```bash
docker compose -p "$OLD_PROJECT" stop -t 180 ai-news
test "$(docker inspect --format '{{.State.Running}}' ai-news)" = false
mkdir -p "$BACKUP/sqlite-raw"
docker cp ai-news:/app/prisma/. "$BACKUP/sqlite-raw/"
test -f "$BACKUP/sqlite-raw/dev.db"
test "$(sqlite3 "$BACKUP/sqlite-raw/dev.db" 'PRAGMA integrity_check;')" = ok
sqlite3 "$BACKUP/sqlite-raw/dev.db" ".backup '$BACKUP/base.db'"
test "$(sqlite3 "$BACKUP/base.db" 'PRAGMA integrity_check;')" = ok
sha256sum "$BACKUP/base.db" > "$BACKUP/base.db.sha256"
sqlite3 "$BACKUP/base.db" \
  "SELECT status, COUNT(*) FROM Article GROUP BY status; SELECT COUNT(*) AS sources FROM Source;"
```

Compose cu bind RIENG file DB; WAL/SHM co the nam trong filesystem container. Chi `cp prisma/dev.db` tren host hoac `cat` DB dang chay co the bo mat transaction trong WAL. Copy ca thu muc tu container DA DUNG giu sidecars, SQLite mo ban copy de recovery WAL truoc khi `.backup` tao snapshot nhat quan.

Chua xoa/recreate container cu cho den khi snapshot da doc duoc. Neu container cu da bi xoa khi WAL chua persist, khong tu ket luan DB host day du: dung lai va phuc hoi tu backup hop le. Giu them backup ma hoa ngoai VPS.

## 5. Dua code moi len va build

```bash
cd "$APP_DIR"
git status --short
git fetch --prune
# Kiem tra ref/release. Chi neu worktree sach va du lieu/config khong bi ghi de:
# git pull --ff-only
```

Neu DB dang duoc Git track hoac worktree dirty, DUNG truoc pull/checkout, doi soat rieng; khong dung reset de ep sach. Co the build tu thu muc release sach rieng: doi APP_DIR sang do, giu OLD_PROJECT_DIR de rollback. Khong ghi de env/DB cu khi dua code moi len.

```bash
cd "$APP_DIR"
test -f scripts/prepare-news-identity.ts
test -f scripts/process-pending.ts
test -f prisma.config.ts
docker build --tag "$NEW_IMAGE" .
docker image inspect "$NEW_IMAGE" --format '{{.Id}}' > "$BACKUP/new-image-id.txt"
git rev-parse HEAD > "$BACKUP/new-code-ref.txt"
```

Dockerfile dung `npm ci`, generate Prisma, rebuild native SQLite Linux, migrate DB TAM `/tmp/ai-news-build.db`, roi `npm run build`. `.dockerignore` loai `.env` va SQLite. Neu co secrets ten khac nhu `.env.production`, dat NGOAI build context va kiem tra ignore; khong truyen secrets qua build args.

Neu Docker build/Turbopack loi, DUNG. Build webpack sandbox Windows da pass khong chung minh image Linux pass. Khong sua dependency/lockfile tren VPS de thu cho qua, khong khoi dong image chua build xong.

## 6. Identity va migration tren BAN SAO

```bash
cp "$BACKUP/base.db" "$WORK/base.db"
chown -R 1001:1001 "$WORK"
chmod 700 "$WORK"

if sqlite3 "$WORK/base.db" \
  "SELECT name FROM pragma_table_info('Article') WHERE name='identityKey';" | grep -qx identityKey; then
  sqlite3 "$WORK/base.db" ".backup '$WORK/prepared.db'"
else
  docker run --rm --network none --user 1001:1001 \
    --entrypoint node -v "$WORK:/work" \
    -e DATABASE_URL=file:/work/unused.db "$NEW_IMAGE" \
    --import tsx scripts/prepare-news-identity.ts \
    --source /work/base.db --copy /work/prepared.db \
    --report /work/identity-collisions.json
fi

chown -R 1001:1001 "$WORK"
docker run --rm --network none --user 1001:1001 \
  --entrypoint node -v "$WORK:/work" \
  -e DATABASE_URL=file:/work/prepared.db "$NEW_IMAGE" \
  node_modules/prisma/build/index.js migrate deploy
docker run --rm --network none --user 1001:1001 \
  --entrypoint node -v "$WORK:/work" \
  -e DATABASE_URL=file:/work/prepared.db "$NEW_IMAGE" \
  node_modules/prisma/build/index.js migrate status
test "$(sqlite3 "$WORK/prepared.db" 'PRAGMA integrity_check;')" = ok
```

Legacy: script tao collision report TRUOC backfill/index, chon owner uu tien published, lien ket duplicate, giu id/slug/status, ghi checksum migration identity vao CHI ban copy. Migration sau do ap cac buoc con lai. Report ton tai khong dong nghia script thanh cong: can exit0, integrityok va migration status sach.

Da co cot identity: khong chay lai backfill; script tu choi DB da co ownership. Neu schema drift/sua tay, ownership nghi ngo, failed migration/checksum lech, phai doi soat rieng. Khong xoa `_prisma_migrations`, reset hay `migrate resolve` mu quang.

Doc `identity-collisions.json` neu duoc tao (co URL/ID nhay cam); phe duyet owner, collisions va unidentified IDs. Legacy fingerprint/evidence thieu duoc giu review, khong tu dich/publish lai backlog cu.

Kiem tra preservation truoc khi doi gate; tat ca cac so sau phai bang0:

```bash
sqlite3 "$WORK/prepared.db" <<SQL
ATTACH DATABASE '$BACKUP/base.db' AS old;
SELECT 'article_state_diff', COUNT(*) FROM (
  SELECT id,slug,status FROM main.Article EXCEPT SELECT id,slug,status FROM old.Article
);
SELECT 'missing_articles', COUNT(*) FROM (
  SELECT id,slug,status FROM old.Article EXCEPT SELECT id,slug,status FROM main.Article
);
SELECT 'source_config_diff', COUNT(*) FROM (
  SELECT id,name,type,url,enabled,configJson FROM main.Source
  EXCEPT SELECT id,name,type,url,enabled,configJson FROM old.Source
);
SELECT 'missing_source_configs', COUNT(*) FROM (
  SELECT id,name,type,url,enabled,configJson FROM old.Source
  EXCEPT SELECT id,name,type,url,enabled,configJson FROM main.Source
);
SELECT 'setting_diff', COUNT(*) FROM (
  SELECT key,value,encrypted FROM main.AppSetting EXCEPT SELECT key,value,encrypted FROM old.AppSetting
);
SELECT 'missing_settings', COUNT(*) FROM (
  SELECT key,value,encrypted FROM old.AppSetting EXCEPT SELECT key,value,encrypted FROM main.AppSetting
);
SQL
```

Neu co diff khong giai thich duoc, dung lai; khong seed de sua diff. Can kiem tra them count nguon/settings khong mat dong, status counts, slug published mau va report truoc khi duyet.

## 7. Gate an toan tren DB moi va CLI dry-run

DB AppSetting UU TIEN hon env. Envfalse khong du neu DBtrue. Buoc nay thay doi CO CHU DICH bon gate tren BAN COPY, khong doi nguong/nguon/settings khac:

```bash
sqlite3 "$WORK/prepared.db" <<'SQL'
BEGIN IMMEDIATE;
INSERT INTO AppSetting (id,key,value,encrypted,updatedAt) VALUES
  ('deploy-' || lower(hex(randomblob(16))),'ai_processing_enabled','false',0,CURRENT_TIMESTAMP),
  ('deploy-' || lower(hex(randomblob(16))),'ai_auto_publish_enabled','false',0,CURRENT_TIMESTAMP),
  ('deploy-' || lower(hex(randomblob(16))),'pending_processing_enabled','false',0,CURRENT_TIMESTAMP),
  ('deploy-' || lower(hex(randomblob(16))),'allow_publish_without_ai','false',0,CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET value=excluded.value, encrypted=0, updatedAt=CURRENT_TIMESTAMP;
COMMIT;
SQL

for SCRIPT in import-source-catalog process-pending; do
  docker run --rm --network none --user 1001:1001 \
    --entrypoint node -v "$WORK:/work" \
    -e DATABASE_URL=file:/work/prepared.db \
    -e AI_PROCESSING_ENABLED=false -e AI_AUTO_PUBLISH_ENABLED=false \
    "$NEW_IMAGE" --import tsx "scripts/$SCRIPT.ts" --dry-run
done
```

Ghi gate changes vao nhat ky: SQL maintenance offline khong tao AdminAudit nhu API, khong thay workflow admin hang ngay. Khong xoa AiReservation/hoan reserved unknown ve0; can giu de chan vuot ngan sach.

CLI khong co API key, network bi tat. Import dry-run chi in ke hoach, KHONG them nguon. Process dry-run khong tao lease/budget/AI; gia chua cau hinh la unknown, khong phai mien phi.

## 8. Runtime va volume moi

Mount THU MUC de persist ca WAL/SHM/journal; khong chi mount file, khong `chmod 777`.

```bash
test ! -e "$DATA/dev.db"
sqlite3 "$WORK/prepared.db" ".backup '$DATA/dev.db'"
chown -R 1001:1001 "$DATA" "$STATE/logs"
chmod 700 "$DATA" "$STATE/logs"
chmod 600 "$DATA/dev.db"
test "$(sqlite3 "$DATA/dev.db" 'PRAGMA integrity_check;')" = ok
cp "$BACKUP/app.env.original" "$STATE/runtime.env"
chmod 600 "$STATE/runtime.env"
nano "$STATE/runtime.env"
```

Neu `test ! -e` fail, KHONG overwrite file. Voi lan deployv2 tiep theo, snapshot DB `/data/dev.db` cua container dang chay va dung DATA release moi; khong lay DB legacy cu thay du lieu moi.

Trong runtime.env, sua secrets da revoke, domain va cac dong sau; khong chep token that vao vi du:

```dotenv
DATABASE_URL="file:/data/dev.db"
APP_BASE_URL="https://news.example.com"
FORCE_HTTP=false
AI_PROCESSING_ENABLED=false
AI_AUTO_PUBLISH_ENABLED=false
PENDING_PROCESSING_ENABLED=false
ALLOW_PUBLISH_WITHOUT_AI=false
AI_DAILY_BUDGET_USD=0
AI_MAX_INPUT_TOKENS=0
AI_MAX_OUTPUT_TOKENS=0
AI_PRICING_JSON={}
```

URL tuyet doi `/data/dev.db` la path TRONG container. Comment env cu noi relative theo prisma directory khong con la quy tac chung. Khong giu duplicate key. Khong can OpenRouter API key khi AI dang tat. Sau nay bat AI can model ID cu the, gia da kiem chung, token limit/budget va phe duyet; `openrouter/auto` khong duoc lap bang gia co dinh, fallback khong tu cho phep goi AI.

Tao Compose RIENG, khong merge voi Compose cu vi cu mount file DB va expose cong ra moi interface:

```bash
printf 'AI_NEWS_IMAGE=%s\n' "$NEW_IMAGE" > "$STATE/image.env"
cat > "$STATE/deploy.compose.yml" <<'YAML'
services:
  ai-news:
    image: ${AI_NEWS_IMAGE:?Set AI_NEWS_IMAGE in image.env}
    env_file:
      - /srv/ai-news/runtime.env
    environment:
      NODE_ENV: production
      PORT: "3000"
      DATABASE_URL: file:/data/dev.db
      AI_PROCESSING_ENABLED: "false"
      AI_AUTO_PUBLISH_ENABLED: "false"
      PENDING_PROCESSING_ENABLED: "false"
      ALLOW_PUBLISH_WITHOUT_AI: "false"
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - /srv/ai-news/data:/data
      - /srv/ai-news/logs:/app/logs
    restart: unless-stopped
YAML
chmod 600 "$STATE/deploy.compose.yml" "$STATE/image.env"
dc() {
  docker compose -p ai-news-v2 --env-file "$STATE/image.env" \
    -f "$STATE/deploy.compose.yml" "$@"
}
dc config --quiet
```

Neu doi STATE, sua ca absolute paths trong YAML; shell khong thay bien trong heredoc quote. Khong chia se output `docker compose config` khong `--quiet`: co the render secrets. Image thua ke HEALTHCHECK tu Dockerfile. Entrypoint khong auto-migrate/seed; `/data` phai duoc operator cap quyen1001.

## 9. Khoi dong va kiem tra

Giu maintenance va lich tat. Chi tiep tuc khi collision/preservation duoc duyet va gatefalse:

```bash
dc up -d --no-build
dc ps
dc logs --tail=100 ai-news
NEW_CONTAINER=$(dc ps -q ai-news)
docker inspect --format '{{.State.Health.Status}}' "$NEW_CONTAINER"
curl --fail --silent --show-error \
  'http://127.0.0.1:3000/api/articles?status=published&pageSize=1' > /dev/null
dc exec -T ai-news node node_modules/prisma/build/index.js migrate status
dc exec -T ai-news npm run sources:import -- --dry-run
dc exec -T ai-news npm run process:pending -- --dry-run --limit 10
sqlite3 "$DATA/dev.db" \
  "SELECT key,value FROM AppSetting WHERE key IN ('ai_processing_enabled','ai_auto_publish_enabled','pending_processing_enabled','allow_publish_without_ai');"
```

Health ban dau co the `starting`; kiem tra lai bang tay sau chu ky healthcheck. `up -d` khong phai da healthy. Neu unhealthy/HTTPloi, xem logs da che secrets, khong bam crawl/previewAI de test.

Qua HTTPS reverse proxy: kiem tra trangchu, slug published da co, dangnhap admin, settings/sources/articles/analytics. Public khong duoc doc pending/trace; anonymous mutation phai bi tu choi. Khong bam testTelegram, crawl, probe hay testAI. HTTP200 chi chung minh read endpoint tra duoc, khong phai full worker/security/nguon/AI acceptance.

Nginx tren host tro `http://127.0.0.1:3000`, forward Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, dung TLS hop le. `nginx -t` truoc reload neu sua config. Giu FORCE_HTTP=false voi HTTPS, khong mo cong3000 public de sua cookie.

Mo lai traffic public chi khi operator chap thuan canary read/admin; cron/AI/auto-publish/Telegram van tat. Khong them lich crawl vao lan deploy nay. Muon rollout pipeline can dong gate T9/live/human/shadow va Docker/API acceptance con thieu truoc.

Ghi nhat ky: ref/image ID, SHAbackup, collision report, migration status, counts/slugs/settings, timestamp, health/HTTPketqua, gatefalse, callAI/Telegram va nguoi phe duyet. Neu lech khong giai thich duoc, rollback.

## 10. Rollback

Giu maintenance/cron tat, doi workers ket thuc. Khong DROP COLUMN/TABLE de revert migration. Rollback DB co the mat du lieu SAU snapshot: luu DBmoi truoc va doi soat, can phe duyet mat/nhap lai du lieu, khong overwrite am tham.

```bash
dc stop -t 180 ai-news
mkdir -p "$BACKUP/new-runtime-raw"
docker cp "$(dc ps -aq ai-news)":/data/. "$BACKUP/new-runtime-raw/"
test "$(sqlite3 "$BACKUP/new-runtime-raw/dev.db" 'PRAGMA integrity_check;')" = ok
```

DB legacy host phai van nguyen trang vi chi thao tac ban copy. Neu file cu da thay doi, DUNG: can stop TOAN BO process dung DBdo, luu DB+sidecars hien tai roi moi phuc hoi base.db va tach sidecars cu khoi duong dan active. Viec nay can phe duyet rieng, khong tu xoa file/sidecar. Khong gan old image vao schema/path moi.

Dung image, Compose, project va mount cu:

```bash
OLD_PROJECT_DIR=$(cat "$BACKUP/old-project-dir.txt")
OLD_PROJECT=$(cat "$BACKUP/old-project.txt")
OLD_IMAGE=$(cat "$BACKUP/old-image.txt")
cd "$OLD_PROJECT_DIR"
printf 'services:\n  ai-news:\n    image: %s\n' "$OLD_IMAGE" > "$BACKUP/rollback-image.yml"
docker compose -p "$OLD_PROJECT" --project-directory "$OLD_PROJECT_DIR" \
  -f "$BACKUP/docker-compose.old.yml" -f "$BACKUP/rollback-image.yml" \
  up -d --no-build ai-news
docker logs --tail=100 ai-news
curl --fail --silent --show-error \
  'http://127.0.0.1:3000/api/articles?status=published&pageSize=1' > /dev/null
```

Gia dinh env cu van o project cu, dung mount cu va da luu day du Compose overrides neu co. Khong rollback secret da revoke ve gia tri lo; credentials moi va ENCRYPTION_KEY phai phu hop DBcu. Chi mo traffic sau khi health/slug/data cu dung; van khong tu bat lich ghi du lieu/tra phi. Giu DB/image moi de phan tich, khong prune backups.

## 11. Van hanh sau canary

Sau reboot, kiem tra volume/UID1001, health, disk, reverse proxy, backup va gateDB. Backup bang SQLite backup API/CLI, khong copy/cat file dang co writer. Test restore tren DBtach rieng theo lich.

Import catalog that can phe duyet, tao moi disabled/unverified va giu override. `sources:probe --dry-run` VAN GOI MANG, khong phai offline. Chi bat nguon verified khi duoc duyet. Pacing HTTP/arXiv hien process-local: khong chay nhieu cron/probe/crawler chong cheo.

Bat AI sau nay can gia/model/budget duoc kiem chung va chap nhan chi phi. DB uu tien env; can quan ly ca Compose environment va DB qua workflow audited. Khong bat auto-publish/Telegram chi vi schema migrate xong hoac fallback model da cau hinh.

## 12. VPS moi hoan toan

Chi dung khi KHONG co DBcu can giu. Build image muc5, tao DATA/permissions muc8, tao runtime.env tu template voi secrets moi. Migrate file trong data directory moi:

```bash
docker run --rm --network none --user 1001:1001 \
  --entrypoint node -v "$DATA:/data" \
  -e DATABASE_URL=file:/data/dev.db "$NEW_IMAGE" \
  node_modules/prisma/build/index.js migrate deploy
```

Seed la lenh RIENG co chu dich, chi DBmoi, khong truyen key provider/Telegram:

```bash
docker run --rm --network none --user 1001:1001 \
  --entrypoint node -v "$DATA:/data" \
  -e DATABASE_URL=file:/data/dev.db \
  -e AI_TRANSLATION_ENABLED=false -e AI_IMPORTANCE_REASON_ENABLED=false \
  -e ALLOW_PUBLISH_WITHOUT_AI=false "$NEW_IMAGE" \
  node_modules/prisma/build/index.js db seed
```

Seed hien tao nguon moi disabled, khong phe duyet live. Dat gateDBfalse nhu muc7 (doi duongdan sang DATA), cau hinh Compose muc8, acceptance muc9; khong chay identity backfill tren DBmoi. Khai bao cac bien duongdan muc3 rieng, khong chay cac lenh backup/inspect yeu cau container cu.

## 13. Checklist

- [ ] Secrets lo da revoke/rotate, encryption settings co ke hoach chuyen key an toan.
- [ ] Dung DB/mount, writers stop, backup ca WAL, integrityok va restore tren ban tach rieng.
- [ ] Giu image/Compose/env cu, backups hanchequyen va ke hoach rollback.
- [ ] Linux image build xong, migration/collision/preservation tren copy duoc duyet.
- [ ] UID1001/volume THU MUC data dung, SQLite sidecars persistent.
- [ ] Gatefalse trong DB va env, cron ben ngoai tat; khong tu bat AI/nguon/Telegram.
- [ ] VPS health/public/slug/admin/security check pass, khong nham HTTP200 voi full acceptance.
- [ ] Nhat ky canary va cac gate T9 conthieu duoc ghi ro; chua rollout pipeline.

Tham khao: [README.md](README.md), [docs/reports/news-quality-after.md](docs/reports/news-quality-after.md), [docs/superpowers/plans/2026-10-30-news-quality-ai-sources.md](docs/superpowers/plans/2026-10-30-news-quality-ai-sources.md).