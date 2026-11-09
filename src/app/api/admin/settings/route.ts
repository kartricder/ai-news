import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayloadFromRequest, requireAdminApi } from '@/lib/authGuard';
import { getAiConfiguration } from '@/lib/ai/budget';
import cron from 'node-cron';

const editableSettings = new Set([
  'publish_threshold',
  'pending_threshold',
  'cron_schedule',
  'app_base_url',
  'max_publish_per_crawl',
  'min_score_to_publish',
  'max_repo_radar_ai_per_crawl',
  'openrouter_model',
  'openrouter_fallback_model',
  'openrouter_second_fallback_model',
  'ai_translation_enabled',
  'ai_importance_reason_enabled',
  'allow_publish_without_ai',
  'ai_processing_enabled',
  'ai_auto_publish_enabled',
  'ai_daily_budget_usd',
  'ai_max_input_tokens',
  'ai_max_output_tokens',
  'ai_pricing_json',
  'pending_processing_enabled',
  'pending_cron_schedule',
  'pending_process_limit',
]);

function maskSetting(key: string, value: string) {
  if (key.includes('token') || key.includes('password') || key.includes('secret') || key.includes('encryption')) {
    return value ? '********' : '';
  }
  return value;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const settings = await prisma.appSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      if (editableSettings.has(setting.key)) {
        settingsMap[setting.key] = maskSetting(setting.key, setting.value);
      }
    }
    const configuration = await getAiConfiguration();
    Object.assign(settingsMap, {
      ai_processing_enabled: String(configuration.enabled), ai_auto_publish_enabled: String(configuration.autoPublish),
      ai_daily_budget_usd: String(configuration.dailyBudgetUsd), ai_max_input_tokens: String(configuration.maxInputTokens),
      ai_max_output_tokens: String(configuration.maxOutputTokens), ai_pricing_json: JSON.stringify(configuration.prices, null, 2),
      pending_processing_enabled: settingsMap.pending_processing_enabled ?? process.env.PENDING_PROCESSING_ENABLED ?? 'false',
      pending_cron_schedule: settingsMap.pending_cron_schedule ?? process.env.PENDING_CRON_SCHEDULE ?? '*/15 * * * *',
      pending_process_limit: settingsMap.pending_process_limit ?? process.env.PENDING_PROCESS_LIMIT ?? '10',
    });
    return NextResponse.json({ data: settingsMap });
  } catch (error) {
    console.error('GET /api/admin/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireAdminApi(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(body)) {
      if (!editableSettings.has(key)) continue;
      if (typeof value !== 'string') {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
      if (['publish_threshold', 'pending_threshold', 'min_score_to_publish'].includes(key)) {
        const numeric = Number(value);
        if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100) {
          return NextResponse.json({ error: `${key} must be an integer from 0 to 100` }, { status: 400 });
        }
      }
      if (['max_publish_per_crawl', 'max_repo_radar_ai_per_crawl'].includes(key)) {
        const numeric = Number(value);
        if (!Number.isInteger(numeric) || numeric < 0 || numeric > 10) {
          return NextResponse.json({ error: `${key} must be an integer from 0 to 10` }, { status: 400 });
        }
      }
      if (['ai_translation_enabled', 'ai_importance_reason_enabled', 'allow_publish_without_ai', 'ai_processing_enabled', 'ai_auto_publish_enabled', 'pending_processing_enabled'].includes(key)) {
        if (!['true', 'false'].includes(value.trim().toLowerCase())) {
          return NextResponse.json({ error: `${key} must be true or false` }, { status: 400 });
        }
      }
      if (['cron_schedule', 'pending_cron_schedule'].includes(key) && !cron.validate(value.trim())) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      if (key === 'pending_cron_schedule' && value.trim().split(/\s+/).length !== 5) return NextResponse.json({ error: 'Pending cron requires five fields (minute precision, UTC)' }, { status: 400 });
      if (key === 'ai_daily_budget_usd' && (!value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10_000)) return NextResponse.json({ error: 'Budget must be between 0 and 10000 USD' }, { status: 400 });
      if (['ai_max_input_tokens', 'ai_max_output_tokens', 'pending_process_limit'].includes(key)) {
        const maximum = key === 'pending_process_limit' ? 10 : key === 'ai_max_input_tokens' ? 100_000 : 16_000;
        if (!value.trim() || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > maximum) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
      if (key === 'ai_pricing_json') {
        let prices: unknown;
        try { prices = JSON.parse(value); } catch { return NextResponse.json({ error: 'Pricing must be valid JSON' }, { status: 400 }); }
        if (!prices || typeof prices !== 'object' || Array.isArray(prices) || Object.keys(prices).length > 20 || value.length > 20_000) return NextResponse.json({ error: 'Invalid price table' }, { status: 400 });
        for (const [model, candidate] of Object.entries(prices)) {
          const price = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate as Record<string, unknown> : {};
          if (!model || /auto|:free/i.test(model) || !['inputUsdPerMillion', 'outputUsdPerMillion'].every((field) => typeof price[field] === 'number' && Number.isFinite(price[field]) && (price[field] as number) >= 0) ||
            typeof price.verifiedAt !== 'string' || !Number.isFinite(Date.parse(price.verifiedAt)) || Date.parse(price.verifiedAt) > Date.now()) return NextResponse.json({ error: `Invalid verified pricing for ${model}` }, { status: 400 });
        }
      }
    }

    const entries = Object.entries(body).filter(([key]) => editableSettings.has(key)) as [string, string][];
    if (!entries.length) return NextResponse.json({ error: 'No editable settings' }, { status: 400 });
    await prisma.$transaction(async (transaction) => {
      const before = await transaction.appSetting.findMany({ where: { key: { in: entries.map(([key]) => key) } }, select: { key: true, value: true } });
      for (const [key, value] of entries) await transaction.appSetting.upsert({ where: { key }, create: { key, value: value.trim(), encrypted: false }, update: { value: value.trim(), encrypted: false } });
      await transaction.adminAudit.create({ data: { actor: getAdminPayloadFromRequest(request)!.username, action: 'settings-update', beforeJson: JSON.stringify(before), afterJson: JSON.stringify(Object.fromEntries(entries)) } });
    });

    const settings = await prisma.appSetting.findMany({ where: { key: { in: Array.from(editableSettings) } } });
    return NextResponse.json({ data: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
  } catch (error) {
    console.error('PUT /api/admin/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
