# Docker Database Permissions Issue

## Vấn đề

Khi chạy Docker với volume mount cho database (`./prisma/dev.db`), có thể gặp lỗi:

```
attempt to write a readonly database
SQLITE_READONLY
```

## Nguyên nhân

- Container chạy với user `nextjs` (UID 1001)
- File `dev.db` từ host có thể thuộc user khác (Windows user, hoặc `node` user)
- SQLite cần quyền **write vào file database VÀ thư mục chứa nó** (để tạo -wal, -shm files)

## Giải pháp

### 1. Fix nhanh (một lần)

```bash
# Chown database file cho user nextjs trong container
docker exec -u root ai-news chown nextjs:nodejs /app/prisma/dev.db

# Chmod để cho phép write
docker exec -u root ai-news chmod 666 /app/prisma/dev.db

# Restart container
docker-compose restart ai-news
```

### 2. Fix lâu dài (Windows development)

Thêm vào `docker-compose.yml`:

```yaml
services:
  ai-news:
    # ... existing config ...
    user: "0:0"  # Run as root to avoid permission issues
```

**Lưu ý:** Chỉ dùng cho development, không khuyến nghị cho production.

### 3. Fix lâu dài (Linux VPS production)

**Option A: Tạo database bên trong container (không mount)**

```yaml
# docker-compose.yml
services:
  ai-news:
    # ... existing config ...
    # REMOVE volume mount for database:
    # - ./prisma/dev.db:/app/prisma/dev.db
    
    # Keep only logs:
    volumes:
      - ./logs:/app/logs
```

Sau đó run migrations trong container:

```bash
docker-compose up -d
docker exec ai-news npx prisma migrate deploy
docker exec ai-news npx prisma db seed
```

**Option B: Fix permissions trên host (Linux)**

```bash
# Trên VPS Linux
chmod 666 prisma/dev.db
chown 1001:1001 prisma/dev.db  # 1001 = nextjs user trong container
```

**Option C: Run container với host user (Linux)**

```yaml
# docker-compose.yml  
services:
  ai-news:
    user: "${UID}:${GID}"  # Use host user
```

Chạy với:

```bash
UID=$(id -u) GID=$(id -g) docker-compose up -d
```

## Best Practice cho Production

**Khuyến nghị: Không mount database file từ host.**

Lý do:
- Database nên nằm trong container hoặc volume riêng
- Tránh vấn đề permissions giữa host/container
- Backup database bằng cách export SQL thay vì copy file

**Setup production:**

1. **Database trong Docker volume:**

```yaml
services:
  ai-news:
    volumes:
      - db-data:/app/prisma
      - ./logs:/app/logs

volumes:
  db-data:
```

2. **Hoặc database riêng (PostgreSQL/MySQL):**

```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```

## Troubleshooting

### Kiểm tra quyền file trong container

```bash
docker exec ai-news ls -la /app/prisma/dev.db
```

Kết quả mong đợi:
```
-rw-rw-rw- 1 nextjs nodejs 2125824 May 19 08:47 /app/prisma/dev.db
```

### Kiểm tra user đang chạy

```bash
docker exec ai-news whoami
# Kết quả: nextjs
```

### Kiểm tra thư mục có write permission

```bash
docker exec ai-news sh -c "touch /app/prisma/test.txt && rm /app/prisma/test.txt"
# Không lỗi = có quyền write
```

### Logs chi tiết

```bash
docker-compose logs --tail=50 ai-news | grep -i "readonly\|permission"
```

## Tại sao lỗi chỉ xảy ra khi crawl?

- **Read operations** (login, view articles): Không cần write → không lỗi
- **Write operations** (crawl, create articles): Cần write → lỗi readonly

Vì vậy trang web vẫn hoạt động bình thường, chỉ features cần ghi DB mới fail.
