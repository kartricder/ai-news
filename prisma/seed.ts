import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
    }
  }

  // Create default app settings
  const settings = [
    { key: 'publish_threshold', value: '75', encrypted: false },
    { key: 'pending_threshold', value: '60', encrypted: false },
    { key: 'cron_schedule', value: '0 6 * * *', encrypted: false },
    { key: 'admin_username', value: 'admin', encrypted: false },
    { key: 'admin_password_hashed', value: '', encrypted: true },
    { key: 'telegram_bot_token', value: '', encrypted: true },
    { key: 'telegram_chat_id', value: '', encrypted: true },
    { key: 'encryption_key', value: '', encrypted: true },
  ];

  for (const setting of settings) {
    const existing = await prisma.appSetting.findUnique({ where: { key: setting.key } });
    if (!existing) {
      await prisma.appSetting.create({ data: setting });
      console.log(`  Created setting: ${setting.key}`);
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
