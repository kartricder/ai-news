import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolveSqliteUrl } from './src/lib/databaseUrl';

export default defineConfig({
  datasource: {
    url: resolveSqliteUrl(process.env.DATABASE_URL, __dirname),
  },
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
