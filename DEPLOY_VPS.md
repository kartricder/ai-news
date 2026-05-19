# Deploy VPS

## Yêu cầu

- Ubuntu 22.04/24.04 hoặc tương đương.
- Node.js LTS mới tương thích Next.js 16.
- Nginx, PM2, Certbot.
- Quyền ghi vào thư mục project cho SQLite `prisma/dev.db`.

## Cài Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2
```

## Cài app

```bash
git clone <repo-url> ai-news
cd ai-news
npm ci
npm rebuild better-sqlite3
cp .env.example .env
```

Sửa `.env` production:

```bash
DATABASE_URL="file:./dev.db"
APP_BASE_URL="https://your-domain.com"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="set-a-strong-password"
ENCRYPTION_KEY="generate-a-long-random-secret"
GITHUB_TOKEN=""
CRON_SCHEDULE="0 6 * * *"
```

Không dùng `admin123` ở production.

## Database

```bash
npm run db:migrate
npm run db:seed
```

## Build và chạy PM2

```bash
npm run build
pm2 start npm --name ai-news -- start
pm2 save
pm2 startup
```

Kiểm tra:

```bash
pm2 logs ai-news
curl http://127.0.0.1:3000
```

## Nginx reverse proxy

Tạo `/etc/nginx/sites-available/ai-news`:

```nginx
server {
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/ai-news /etc/nginx/sites-enabled/ai-news
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Cron crawler

Khuyến nghị VPS dùng system cron thay vì app scheduler.

```bash
crontab -e
```

Thêm:

```cron
0 6 * * * cd /path/to/ai-news && /usr/bin/npm run crawl >> logs/crawl.log 2>&1
```

Tạo thư mục log:

```bash
mkdir -p logs
```

Nếu muốn chạy scheduler trong process Node, chỉ dùng một process PM2 và gọi `startScheduler()` từ bootstrap riêng; không chạy song song với system cron để tránh crawl trùng.

## Backup/restore SQLite

Backup hằng ngày:

```bash
mkdir -p backups
cp prisma/dev.db backups/dev-$(date +%F).db
```

Restore:

```bash
pm2 stop ai-news
cp backups/dev-YYYY-MM-DD.db prisma/dev.db
pm2 start ai-news
```

## Update source code

```bash
git pull
npm ci
npm rebuild better-sqlite3
npm run db:migrate
npm run build
pm2 restart ai-news
```
