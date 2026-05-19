.PHONY: help build up down restart logs shell crawl backup restore clean

# Default target
help:
	@echo "🚀 AI News Docker Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          - Initial setup (copy .env, build, start)"
	@echo ""
	@echo "Container Management:"
	@echo "  make build          - Build Docker image"
	@echo "  make up             - Start containers"
	@echo "  make down           - Stop containers"
	@echo "  make restart        - Restart containers"
	@echo "  make rebuild        - Rebuild and restart"
	@echo ""
	@echo "Logs & Debug:"
	@echo "  make logs           - View logs (follow mode)"
	@echo "  make logs-tail      - View last 100 lines"
	@echo "  make shell          - Open shell in container"
	@echo "  make ps             - Show container status"
	@echo ""
	@echo "Database:"
	@echo "  make migrate        - Run database migrations"
	@echo "  make seed           - Seed database"
	@echo "  make backup         - Backup database"
	@echo "  make restore FILE=  - Restore database from backup"
	@echo ""
	@echo "Operations:"
	@echo "  make crawl          - Run crawler manually"
	@echo "  make health         - Check application health"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean          - Stop and remove containers"
	@echo "  make clean-all      - Remove containers, volumes, and images"

# Setup
setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env file. Please edit it with your settings."; \
		echo "⚠️  Don't forget to change ADMIN_PASSWORD and ENCRYPTION_KEY!"; \
	fi
	@mkdir -p logs backups
	docker-compose up -d --build
	@echo "✅ Application started at http://localhost:3000"

# Build
build:
	docker-compose build

rebuild:
	docker-compose up -d --build

# Container control
up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

# Logs
logs:
	docker-compose logs -f

logs-tail:
	docker-compose logs --tail=100

# Shell access
shell:
	docker-compose exec ai-news sh

# Status
ps:
	docker-compose ps

# Database operations
migrate:
	docker-compose exec ai-news npm run db:migrate

seed:
	docker-compose exec ai-news npm run db:seed

backup:
	@mkdir -p backups
	@docker-compose exec -T ai-news cat prisma/dev.db > backups/db-$$(date +%Y%m%d-%H%M%S).db
	@echo "✅ Database backed up to backups/db-$$(date +%Y%m%d-%H%M%S).db"

restore:
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Error: Please specify FILE=path/to/backup.db"; \
		exit 1; \
	fi
	docker-compose stop
	cp $(FILE) prisma/dev.db
	docker-compose start
	@echo "✅ Database restored from $(FILE)"

# Crawler
crawl:
	docker-compose exec ai-news npm run crawl

# Health check
health:
	@docker-compose exec ai-news wget -q --spider http://localhost:3000/api/articles?status=published\&pageSize=1 && \
		echo "✅ Application is healthy" || \
		echo "❌ Application is unhealthy"

# Cleanup
clean:
	docker-compose down
	@echo "✅ Containers stopped and removed"

clean-all:
	docker-compose down -v --rmi all
	@echo "⚠️  Containers, volumes, and images removed"
	@echo "⚠️  Database has been deleted!"
