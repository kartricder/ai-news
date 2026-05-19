# Docker Deployment Guide

## 📦 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+

### 1. Setup Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your production values
nano .env
```

**Important**: Change these values in `.env`:
- `ADMIN_PASSWORD` - Set a strong password
- `ENCRYPTION_KEY` - Generate a random 32+ character string
- `APP_BASE_URL` - Your domain URL
- `GITHUB_TOKEN` - (Optional) GitHub personal access token

### 2. Build and Run
```bash
# Build and start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Check container status
docker-compose ps
```

### 3. Verify Application
```bash
# Check health
curl http://localhost:3000/api/articles?status=published&pageSize=1

# Or visit in browser
open http://localhost:3000
```

## 🔧 Common Commands

### Start/Stop
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Stop and remove volumes (⚠️ deletes database)
docker-compose down -v
```

### Logs & Debugging
```bash
# View all logs
docker-compose logs -f

# View logs for last 100 lines
docker-compose logs --tail=100

# Execute shell in container
docker-compose exec ai-news sh

# Check database
docker-compose exec ai-news ls -la prisma/
```

### Database Management
```bash
# Run migrations manually
docker-compose exec ai-news npm run db:migrate

# Seed database manually
docker-compose exec ai-news npm run db:seed

# Run crawler
docker-compose exec ai-news npm run crawl
```

### Updates & Rebuilds
```bash
# Rebuild after code changes
docker-compose up -d --build

# Force rebuild without cache
docker-compose build --no-cache
docker-compose up -d
```

## 🚀 Production Deployment

### With Nginx Reverse Proxy

1. **Create Nginx config** `/etc/nginx/sites-available/ai-news`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (use Certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

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

2. **Enable site**:
```bash
sudo ln -s /etc/nginx/sites-available/ai-news /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

3. **Setup SSL with Certbot**:
```bash
sudo certbot --nginx -d your-domain.com
```

### Auto-start on Boot
Docker Compose with `restart: unless-stopped` will automatically start the container on system boot.

### Scheduled Crawler
Add to crontab:
```bash
# Edit crontab
crontab -e

# Add daily crawl at 6 AM
0 6 * * * cd /path/to/ai-news && docker-compose exec -T ai-news npm run crawl >> logs/crawl.log 2>&1
```

## 💾 Backup & Restore

### Backup Database
```bash
# Create backup directory
mkdir -p backups

# Backup current database
docker-compose exec -T ai-news cat prisma/dev.db > backups/db-$(date +%Y%m%d-%H%M%S).db

# Or copy directly from host
cp prisma/dev.db backups/db-$(date +%Y%m%d-%H%M%S).db
```

### Restore Database
```bash
# Stop container
docker-compose stop

# Restore from backup
cp backups/db-YYYYMMDD-HHMMSS.db prisma/dev.db

# Start container
docker-compose start
```

### Automated Daily Backup
Add to crontab:
```bash
0 2 * * * cp /path/to/ai-news/prisma/dev.db /path/to/backups/db-$(date +\%Y\%m\%d).db
```

## 🔍 Monitoring

### Health Check
```bash
# Manual health check
docker-compose exec ai-news wget -q --spider http://localhost:3000/api/articles?status=published&pageSize=1

# View health status
docker inspect --format='{{.State.Health.Status}}' ai-news
```

### Resource Usage
```bash
# View container stats
docker stats ai-news

# View disk usage
docker system df
```

## ⚡ Performance Tuning

### Limit Resources
Update `docker-compose.yml`:
```yaml
services:
  ai-news:
    # ... existing config
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          memory: 256M
```

### Enable BuildKit for Faster Builds
```bash
export DOCKER_BUILDKIT=1
docker-compose build
```

## 🐛 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs

# Check container status
docker ps -a

# Remove and recreate
docker-compose down
docker-compose up -d
```

### Database Issues
```bash
# Reset database (⚠️ deletes all data)
docker-compose down
rm prisma/dev.db
docker-compose up -d
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R $USER:$USER prisma/ logs/
```

### Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000

# Or change port in docker-compose.yml
ports:
  - "3001:3000"
```

## 📊 Multi-Container Setup (Advanced)

For PostgreSQL instead of SQLite:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ainews
      POSTGRES_PASSWORD: your-secure-password
      POSTGRES_DB: ainews
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - ai-news-network

  ai-news:
    # ... existing config
    depends_on:
      - postgres
    environment:
      - DATABASE_URL=postgresql://ainews:your-secure-password@postgres:5432/ainews

volumes:
  postgres-data:

networks:
  ai-news-network:
    driver: bridge
```

## 🔐 Security Best Practices

1. **Never commit `.env` file** - Use `.env.example` template
2. **Use strong passwords** - Generate with `openssl rand -base64 32`
3. **Run as non-root user** - Already configured in Dockerfile
4. **Keep images updated** - Regularly rebuild with `docker-compose pull && docker-compose up -d --build`
5. **Use HTTPS** - Always use SSL/TLS in production
6. **Limit exposed ports** - Only expose necessary ports
7. **Regular backups** - Automate database backups

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
