# Deploy VPS

**Mục lục:**
- [Deploy với PM2 (Node.js trực tiếp)](#deploy-với-pm2-nodejs-trực-tiếp)
- [Deploy với Docker](#deploy-với-docker-khuyến-nghị)
- [Deploy không có tên miền (chỉ IP)](#deploy-không-có-tên-miền-chỉ-ip)

---

## Yêu cầu

- Ubuntu 22.04/24.04 hoặc tương đương
- **Option 1 (PM2):** Node.js 24.x, Nginx, PM2
- **Option 2 (Docker):** Docker, Docker Compose
- Quyền sudo và SSH access
- Port 80 (HTTP) hoặc 443 (HTTPS) mở firewall

---

## Deploy với PM2 (Node.js trực tiếp)

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

---

## Deploy với Docker (Khuyến nghị)

### 1. Cài Docker và Docker Compose

```bash
# Cài Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Cài Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Logout và login lại để apply group changes
```

### 2. Clone và setup project

```bash
git clone <repo-url> ai-news
cd ai-news
cp .env.example .env
```

### 3. Cấu hình .env

**Với tên miền:**
```env
DATABASE_URL="file:./dev.db"
APP_BASE_URL="https://your-domain.com"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="YourStrongPassword123!"
ENCRYPTION_KEY="$(openssl rand -base64 32)"
GITHUB_TOKEN=""
```

**Không có tên miền (dùng IP):**
```env
DATABASE_URL="file:./dev.db"
APP_BASE_URL="http://YOUR_VPS_IP:3000"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="YourStrongPassword123!"
ENCRYPTION_KEY="$(openssl rand -base64 32)"
GITHUB_TOKEN=""
```

### 4. Build và chạy

```bash
# Build image
docker-compose build

# Start services
docker-compose up -d

# Xem logs
docker-compose logs -f

# Kiểm tra status
docker-compose ps
```

### 5. Nginx reverse proxy (optional)

Nếu muốn chạy trên port 80 thay vì 3000:

```bash
sudo apt-get install -y nginx
```

Tạo `/etc/nginx/sites-available/ai-news`:

**Với tên miền:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Không có tên miền (dùng IP):**
```nginx
server {
    listen 80 default_server;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable và reload:
```bash
sudo ln -s /etc/nginx/sites-available/ai-news /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Xóa site mặc định
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL với Certbot (chỉ khi có domain)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 7. Cron crawler

```bash
crontab -e
```

Thêm:
```cron
0 6 * * * cd /home/user/ai-news && docker-compose exec -T ai-news npm run crawl >> logs/crawl.log 2>&1
```

### 8. Docker commands hữu ích

```bash
# Xem logs
docker-compose logs -f
docker-compose logs --tail=50 ai-news

# Restart
docker-compose restart

# Stop
docker-compose down

# Update code
git pull
docker-compose up -d --build

# Backup database
docker-compose exec -T ai-news cat prisma/dev.db > backups/db-$(date +%Y%m%d).db

# Shell vào container
docker-compose exec ai-news sh
```

---

## Deploy không có tên miền (chỉ IP)

### Tình huống

Bạn có VPS với IP public (ví dụ: `123.45.67.89`) nhưng **chưa có tên miền**.

### Option 1: Truy cập trực tiếp qua IP:3000

**Ưu điểm:** Đơn giản, không cần Nginx  
**Nhược điểm:** Phải nhớ port, không có HTTPS

#### Cấu hình

1. **Mở port 3000 trên firewall:**

```bash
# UFW
sudo ufw allow 3000/tcp

# Hoặc AWS Security Group / GCP Firewall
# Thêm rule: TCP port 3000 from 0.0.0.0/0
```

2. **Cập nhật .env:**

```env
APP_BASE_URL="http://123.45.67.89:3000"
```

3. **Docker: expose port trong docker-compose.yml** (đã có sẵn)

```yaml
ports:
  - "3000:3000"
```

4. **Truy cập:**

```
http://123.45.67.89:3000
```

### Option 2: Nginx reverse proxy (port 80)

**Ưu điểm:** Truy cập qua port 80 (không cần ghi :3000)  
**Nhược điểm:** Vẫn HTTP (không mã hóa)

#### Cấu hình

1. **Cài Nginx:**

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

2. **Tạo config `/etc/nginx/sites-available/ai-news`:**

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    # Không cần server_name khi dùng IP
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Tăng timeout cho Next.js
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
}
```

3. **Enable site:**

```bash
# Xóa default site
sudo rm /etc/nginx/sites-enabled/default

# Enable ai-news
sudo ln -s /etc/nginx/sites-available/ai-news /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

4. **Mở port 80:**

```bash
sudo ufw allow 80/tcp
```

5. **Cập nhật .env:**

```env
APP_BASE_URL="http://123.45.67.89"
```

6. **Restart app:**

```bash
# Docker
docker-compose down && docker-compose up -d

# PM2
pm2 restart ai-news
```

7. **Truy cập:**

```
http://123.45.67.89
```

### Option 3: Self-signed SSL (không khuyến nghị)

**Ưu điểm:** Có HTTPS  
**Nhược điểm:** Browser sẽ warning "Not secure"

```bash
# Tạo self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/ai-news.key \
  -out /etc/ssl/certs/ai-news.crt \
  -subj "/CN=123.45.67.89"

# Nginx config với SSL
server {
    listen 443 ssl default_server;
    
    ssl_certificate /etc/ssl/certs/ai-news.crt;
    ssl_certificate_key /etc/ssl/private/ai-news.key;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        # ... rest of config
    }
}
```

### Khuyến nghị

| Tình huống | Giải pháp |
|------------|-----------|
| **Test nhanh** | Option 1 (IP:3000) |
| **Production tạm** | Option 2 (Nginx port 80) |
| **Production thực sự** | Mua domain + SSL/Certbot |

### ⚠️ Lưu ý bảo mật khi dùng IP

1. **Đổi password admin mạnh:**
   ```env
   ADMIN_PASSWORD="VeryStrongPassword123!@#"
   ```

2. **Giới hạn IP truy cập admin (optional):**
   
   Trong Nginx config:
   ```nginx
   location /admin {
       allow 203.0.113.0/24;  # IP công ty/nhà bạn
       deny all;
       
       proxy_pass http://127.0.0.1:3000;
       # ... rest
   }
   ```

3. **Bật firewall:**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw status
   ```

4. **Cân nhắc mua domain:**
   - Namecheap, Cloudflare: ~$10/năm
   - Free SSL với Let's Encrypt
   - Chuyên nghiệp hơn

---

## Troubleshooting

### Container không start

```bash
# Xem logs chi tiết
docker-compose logs

# Kiểm tra port conflict
sudo netstat -tulpn | grep 3000

# Remove và rebuild
docker-compose down -v
docker-compose up -d --build
```

### Database lỗi

```bash
# Xem database file
ls -la prisma/dev.db

# Check permissions
sudo chown -R $USER:$USER prisma/

# Reset database (⚠️ mất data)
rm prisma/dev.db
docker-compose exec ai-news npx prisma migrate dev
docker-compose exec ai-news npx prisma db seed
```

### Nginx 502 Bad Gateway

```bash
# Kiểm tra app đang chạy
curl http://localhost:3000

# Kiểm tra SELinux (CentOS/RHEL)
sudo setsebool -P httpd_can_network_connect 1

# Xem logs
sudo tail -f /var/log/nginx/error.log
```

### Port đã bị dùng

```bash
# Tìm process đang dùng port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Hoặc đổi port trong docker-compose.yml
ports:
  - "3001:3000"
```

---

## Backup & Monitoring

### Automated Backup Script

Tạo `/home/user/backup-ai-news.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/home/user/ai-news-backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cd /home/user/ai-news
docker-compose exec -T ai-news cat prisma/dev.db > $BACKUP_DIR/db-$DATE.db

# Backup .env
cp .env $BACKUP_DIR/env-$DATE.txt

# Keep only last 30 days
find $BACKUP_DIR -name "db-*.db" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Chmod và thêm vào cron:
```bash
chmod +x /home/user/backup-ai-news.sh

crontab -e
# Backup hàng ngày lúc 2 AM
0 2 * * * /home/user/backup-ai-news.sh >> /home/user/backup.log 2>&1
```

### Monitoring với Uptime Kuma (optional)

```bash
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1

# Truy cập http://YOUR_IP:3001 để setup
```

---

## Performance Optimization

### 1. Nginx caching

Thêm vào Nginx config:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=ai_news_cache:10m max_size=100m inactive=60m use_temp_path=off;

server {
    location /api/articles {
        proxy_cache ai_news_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        add_header X-Cache-Status $upstream_cache_status;
        
        proxy_pass http://127.0.0.1:3000;
    }
}
```

### 2. Gzip compression

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
```

### 3. PM2 Cluster mode (nếu dùng PM2)

```bash
pm2 start npm --name ai-news -i max -- start
pm2 save
```
