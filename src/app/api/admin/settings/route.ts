import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/authGuard';
import { setSetting } from '@/lib/settings';

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
    if (!body || typeof body !== 'object') {
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
        if (!Number.isInteger(numeric) || numeric < 0 || numeric > 50) {
          return NextResponse.json({ error: `${key} must be an integer from 0 to 50` }, { status: 400 });
        }
      }
      if (['ai_translation_enabled', 'ai_importance_reason_enabled', 'allow_publish_without_ai'].includes(key)) {
        if (!['true', 'false'].includes(value.trim().toLowerCase())) {
          return NextResponse.json({ error: `${key} must be true or false` }, { status: 400 });
        }
      }
      await setSetting(key, value.trim(), false);
    }

    const settings = await prisma.appSetting.findMany({ where: { key: { in: Array.from(editableSettings) } } });
    return NextResponse.json({ data: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
  } catch (error) {
    console.error('PUT /api/admin/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
