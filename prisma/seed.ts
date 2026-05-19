import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import { hashPassword } from '../src/lib/auth';

async function main() {
  const dbPath = path.resolve(__dirname, 'dev.db');
  console.log('Connecting to database at:', dbPath);

  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding database...');

  // Create default sources
  const sources = [
    { name: 'OpenAI Blog', type: 'rss', url: 'https://openai.com/blog/rss.xml', enabled: true },
    { name: 'Anthropic Blog', type: 'rss', url: 'https://www.anthropic.com/feed.xml', enabled: true },
    { name: 'Google AI Blog', type: 'rss', url: 'https://blog.google/technology/ai/rss/', enabled: true },
    { name: 'Meta AI Blog', type: 'rss', url: 'https://ai.meta.com/blog/rss/', enabled: true },
    { name: 'GitHub Trending', type: 'github', url: 'https://api.github.com/search/repositories?q=ai+llm+sort:stars', enabled: true },
    { name: 'Hacker News', type: 'hackernews', url: 'https://hn.algolia.com/api/v1/search?query=ai&tags=story&hitsPerPage=20', enabled: true },
    { name: 'Reddit r/LocalLLaMA', type: 'reddit', url: 'https://www.reddit.com/r/LocalLLaMA/hot.json', enabled: true },
    { name: 'Reddit r/MachineLearning', type: 'reddit', url: 'https://www.reddit.com/r/MachineLearning/hot.json', enabled: true },
    { name: 'Reddit r/OpenAI', type: 'reddit', url: 'https://www.reddit.com/r/OpenAI/hot.json', enabled: true },
    { name: 'DeepMind Blog', type: 'rss', url: 'https://deepmind.google/blog/rss/', enabled: true },
  ];

  for (const source of sources) {
    const existing = await prisma.source.findUnique({ where: { name: source.name } });
    if (!existing) {
      await prisma.source.create({ data: source });
      console.log(`  Created source: ${source.name}`);
    } else {
      console.log(`  Skipped (exists): ${source.name}`);
    }
  }

  // Create default app settings
  const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');
  const settings = [
    { key: 'publish_threshold', value: '75', encrypted: false },
    { key: 'pending_threshold', value: '60', encrypted: false },
    { key: 'cron_schedule', value: process.env.CRON_SCHEDULE || '0 6 * * *', encrypted: false },
    { key: 'app_base_url', value: process.env.APP_BASE_URL || 'http://localhost:3000', encrypted: false },
    { key: 'max_publish_per_crawl', value: process.env.MAX_PUBLISH_PER_CRAWL || '10', encrypted: false },
    { key: 'min_score_to_publish', value: process.env.MIN_SCORE_TO_PUBLISH || '75', encrypted: false },
    { key: 'max_repo_radar_ai_per_crawl', value: process.env.MAX_REPO_RADAR_AI_PER_CRAWL || '10', encrypted: false },
    { key: 'openrouter_model', value: process.env.OPENROUTER_MODEL || 'openrouter/auto', encrypted: false },
    { key: 'openrouter_fallback_model', value: process.env.OPENROUTER_FALLBACK_MODEL || 'google/gemini-2.5-flash', encrypted: false },
    { key: 'openrouter_second_fallback_model', value: process.env.OPENROUTER_SECOND_FALLBACK_MODEL || 'mistralai/mistral-small-3.2-24b-instruct', encrypted: false },
    { key: 'ai_translation_enabled', value: process.env.AI_TRANSLATION_ENABLED || 'true', encrypted: false },
    { key: 'ai_importance_reason_enabled', value: process.env.AI_IMPORTANCE_REASON_ENABLED || 'true', encrypted: false },
    { key: 'allow_publish_without_ai', value: process.env.ALLOW_PUBLISH_WITHOUT_AI || 'false', encrypted: false },
    { key: 'admin_username', value: process.env.ADMIN_USERNAME || 'admin', encrypted: false },
    { key: 'admin_password_hashed', value: adminPassword ? await hashPassword(adminPassword) : '', encrypted: true },
    { key: 'telegram_bot_token', value: '', encrypted: true },
    { key: 'telegram_chat_id', value: '', encrypted: true },
  ];

  for (const setting of settings) {
    const existing = await prisma.appSetting.findUnique({ where: { key: setting.key } });
    if (!existing) {
      await prisma.appSetting.create({ data: setting });
      console.log(`  Created setting: ${setting.key}`);
    } else if (setting.key === 'admin_password_hashed' && !existing.value && setting.value) {
      await prisma.appSetting.update({
        where: { key: setting.key },
        data: { value: setting.value, encrypted: true },
      });
      console.log(`  Updated empty setting: ${setting.key}`);
    } else {
      console.log(`  Skipped (exists): ${setting.key}`);
    }
  }

  await prisma.$disconnect();
  console.log('Seed completed successfully!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
