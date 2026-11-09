import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { createTestDatabase, projectRoot, runTestCode, runTestProcess } from '../helpers/testDatabase';

test('mock transport, durable budget/backlog/cache and readonly CLI smoke use an isolated database', () => {
  const database = createTestDatabase();
  try {
    const migrated = runTestProcess([path.join(projectRoot, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], database.databaseUrl);
    assert.equal(migrated.status, 0, migrated.stderr || migrated.error?.message);
    const result = runTestCode(`
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const crypto = require('node:crypto');
      const { prisma } = require(${JSON.stringify(path.join(projectRoot, 'src/lib/prisma.ts'))});
      const { setSetting } = require(${JSON.stringify(path.join(projectRoot, 'src/lib/settings.ts'))});
      const { processArticleWithAI } = require(${JSON.stringify(path.join(projectRoot, 'src/lib/ai/openRouter.ts'))});
      const { reserveAiBudget, settleAiBudget } = require(${JSON.stringify(path.join(projectRoot, 'src/lib/ai/budget.ts'))});
      const { processPendingArticles } = require(${JSON.stringify(path.join(projectRoot, 'src/lib/pipeline/processPending.ts'))});
      const { getIdentityKey } = require(${JSON.stringify(path.join(projectRoot, 'src/lib/news/identity.ts'))});
      const { evaluationCases } = require(${JSON.stringify(path.join(projectRoot, 'tests/fixtures/news-eval/cases.ts'))});
      (async () => {
        try {
          const price = { inputUsdPerMillion: 1, outputUsdPerMillion: 1, verifiedAt: '2026-01-01' };
          const settings = { ai_processing_enabled: 'true', ai_auto_publish_enabled: 'false', ai_daily_budget_usd: '0.25', ai_max_input_tokens: '8000', ai_max_output_tokens: '1000',
            ai_pricing_json: JSON.stringify({ 'fixture/model-a': price, 'fixture/model-b': price }), openrouter_model: 'fixture/model-a',
            openrouter_fallback_model: 'fixture/model-b', openrouter_second_fallback_model: 'fixture/model-b',
            ai_translation_enabled: 'true', ai_importance_reason_enabled: 'true', allow_publish_without_ai: 'false' };
          for (const [key, value] of Object.entries(settings)) await setSetting(key, value);
          process.env.OPENROUTER_API_KEY = 'mock-only-not-a-real-key';
          const valid = { titleVi: 'Thong bao ky thuat', briefVi: 'Tai lieu mo ta pham vi va gioi han ap dung.', whyImportant: 'Can kiem tra dieu kien van hanh.', aiTags: ['AI'],
            targetAudience: 'developer', impactLevel: 'medium', claims: [{ text: 'Tai lieu ky thuat', evidenceIds: ['source-1'] }], uncertainties: [], qualityFlags: [] };
          const source = evaluationCases[0].item;
          const input = { originalTitle: source.title, originalText: source.text, evidenceLevel: source.evidenceLevel, sourceName: 'Fixture', sourceUrl: source.articleUrl, category: 'model-release', tags: [] };
          let calls = 0;
          const models = [];
          globalThis.fetch = async (url, options) => {
            assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
            const body = JSON.parse(options.body); models.push(body.model); calls++;
            assert.equal(await prisma.aiReservation.count({ where: { status: 'reserved' } }), 1);
            return new Response(JSON.stringify({ id: 'mock-' + calls, model: body.model, provider: 'fixture-provider',
              ...(calls < 3 ? { usage: { prompt_tokens: 10, completion_tokens: 10, cost: 0.00001 } } : {}),
              choices: [{ message: { content: JSON.stringify(calls < 3 ? { ...valid, titleVi: undefined } : valid) } }] }), { status: 200 });
          };
          const fallback = await processArticleWithAI(input);
          assert.equal(fallback.status, 'fallback_success'); assert.equal(calls, 3);
          assert.deepEqual(models, ['fixture/model-a', 'fixture/model-a', 'fixture/model-b']);
          assert.equal(await prisma.aiAttempt.count(), 3);
          const unknown = await prisma.aiReservation.findFirstOrThrow({ where: { status: 'unknown' } });
          const dayBefore = await prisma.aiBudgetDay.findUniqueOrThrow({ where: { day: unknown.day } });
          await settleAiBudget(unknown.id, null);
          assert.deepEqual(await prisma.aiBudgetDay.findUnique({ where: { day: unknown.day } }), dayBefore);
          assert.ok(dayBefore.reservedMicros >= unknown.estimatedMicros);
          globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { refusal: 'fixture refusal' }, finish_reason: 'content_filter' }] }), { status: 200 }); };
          await assert.rejects(() => processArticleWithAI(input), error => error.code === 'refusal');
          assert.equal(calls, 4);
          globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: { code: 429 } }), { status: 429, headers: { 'Retry-After': '300' } }); };
          await assert.rejects(() => processArticleWithAI(input), error => error.code === 'temporary' && error.nextRetryAt > new Date(Date.now() + 200000));
          assert.equal(calls, 5);
          await assert.rejects(() => processArticleWithAI({ ...input, translationEnabled: false, reasonEnabled: false }), error => error.code === 'disabled');
          assert.equal(calls, 5);
          const reservations = await Promise.all([reserveAiBudget('budget-one', 0.15), reserveAiBudget('budget-two', 0.15)]);
          assert.equal(reservations.filter(Boolean).length, 1);
          const winningId = reservations[0] ? 'budget-one' : 'budget-two';
          await settleAiBudget(winningId, null);
          assert.equal(await reserveAiBudget('over-budget', 0.15), false);
          await setSetting('ai_daily_budget_usd', '1');
          globalThis.fetch = async (url, options) => { calls++; assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions'); return new Response(JSON.stringify({ model: JSON.parse(options.body).model, provider: 'fixture-provider', usage: { cost: 0.00001 }, choices: [{ message: { content: JSON.stringify(valid) } }] }), { status: 200 }); };
          for (let index = 0; index < 3; index++) {
            const articleUrl = 'https://backlog-' + index + '.invalid/article';
            await prisma.article.create({ data: { id: 'backlog-' + index, slug: 'preserved-backlog-' + index, title: source.title, originalTitle: source.title,
              originalText: source.text, summaryVi: '', sourceName: 'Fixture', sourceUrl: source.sourceUrl, originalUrl: articleUrl, canonicalUrl: articleUrl,
              identityKey: getIdentityKey({ ...source, articleUrl }), fingerprint: 'fixture-content', status: 'pending', processingStatus: 'queued', evidenceLevel: 'article',
              originalPublishedAt: new Date(), originalLanguage: 'en', sourceKind: 'official', publisherKey: 'publisher-' + index } });
          }
          const hash = () => crypto.createHash('sha256').update(fs.readFileSync(${JSON.stringify(database.databasePath)})).digest('hex');
          const beforePreview = hash();
          const preview = await processPendingArticles({ limit: 2, dryRun: true });
          assert.equal(preview.selected, 2); assert.equal(preview.processed, 0); assert.equal(hash(), beforePreview);
          const first = await processPendingArticles({ limit: 2, dryRun: false }); assert.equal(first.processed, 2, JSON.stringify(first)); assert.equal(first.published, 0);
          const second = await processPendingArticles({ limit: 2, dryRun: false }); assert.equal(second.processed, 1, JSON.stringify(second));
          assert.equal(calls, 8);
          await prisma.article.update({ where: { id: 'backlog-0' }, data: { processingStatus: 'queued' } });
          const cached = await processPendingArticles({ limit: 2, dryRun: false }); assert.equal(cached.processed, 1); assert.equal(calls, 8);
          assert.equal(await prisma.article.count({ where: { status: 'published' } }), 0);
          assert.equal(await prisma.telegramLog.count(), 0);
          assert.equal((await prisma.article.findUniqueOrThrow({ where: { id: 'backlog-0' } })).slug, 'preserved-backlog-0');
          console.log(JSON.stringify({ mockCalls: calls, fallbackCalls: 3, refusalCalls: 1, rateLimitCalls: 1, backlogGenerations: 3, published: 0, telegram: 0 }));
        } finally { await prisma.$disconnect(); }
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `, database.databaseUrl);
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    for (const [script, args] of [['scripts/import-source-catalog.ts', ['--dry-run']], ['scripts/process-pending.ts', ['--dry-run', '--limit', '10']]] as const) {
      const checked = runTestProcess(['--import', 'tsx', script, ...args], database.databaseUrl);
      assert.equal(checked.status, 0, checked.stderr || checked.error?.message);
    }
  } finally { database.cleanup(); }
});