import { prisma } from '../prisma';
import { getSetting } from '../settings';

export type ModelPrice = { inputUsdPerMillion: number; outputUsdPerMillion: number; verifiedAt: string };
export type AiConfiguration = {
  enabled: boolean; dailyBudgetUsd: number; maxInputTokens: number; maxOutputTokens: number;
  prices: Record<string, ModelPrice>; autoPublish: boolean;
};
const configurationKeys = ['ai_processing_enabled', 'ai_daily_budget_usd', 'ai_max_input_tokens', 'ai_max_output_tokens', 'ai_pricing_json', 'ai_auto_publish_enabled'];

export async function getAiConfiguration(): Promise<AiConfiguration> {
  const entries = await Promise.all(configurationKeys.map(async (key) => [key, await getSetting(key)] as const));
  return parseAiConfiguration(Object.fromEntries(entries));
}

export function parseAiConfiguration(values: Record<string, string | null>): AiConfiguration {
  const value = (index: number) => values[configurationKeys[index]] ?? process.env[configurationKeys[index].toUpperCase()] ?? '';
  const positive = (text: string) => text.trim() && Number.isFinite(Number(text)) && Number(text) > 0 ? Number(text) : 0;
  const raw: unknown = (() => { try { return JSON.parse(value(4) || '{}'); } catch { return {}; } })();
  const prices: Record<string, ModelPrice> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [model, candidate] of Object.entries(raw)) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const price = candidate as Record<string, unknown>;
      if (typeof price.inputUsdPerMillion !== 'number' || typeof price.outputUsdPerMillion !== 'number' ||
          !Number.isFinite(price.inputUsdPerMillion) || !Number.isFinite(price.outputUsdPerMillion) || price.inputUsdPerMillion < 0 || price.outputUsdPerMillion < 0 ||
          typeof price.verifiedAt !== 'string' || !Number.isFinite(Date.parse(price.verifiedAt)) || Date.parse(price.verifiedAt) > Date.now() ||
          /auto|:free/i.test(model)) continue;
      prices[model] = { inputUsdPerMillion: price.inputUsdPerMillion, outputUsdPerMillion: price.outputUsdPerMillion, verifiedAt: price.verifiedAt };
    }
  }
  const maxInputTokens = positive(value(2));
  const maxOutputTokens = positive(value(3));
  return { enabled: value(0) === 'true', dailyBudgetUsd: positive(value(1)),
    maxInputTokens: Number.isInteger(maxInputTokens) && maxInputTokens <= 100_000 ? maxInputTokens : 0,
    maxOutputTokens: Number.isInteger(maxOutputTokens) && maxOutputTokens <= 16_000 ? maxOutputTokens : 0,
    prices, autoPublish: value(5) === 'true' };
}

export function estimateAttemptUsd(configuration: AiConfiguration, model: string): number | null {
  const price = configuration.prices[model];
  if (!configuration.enabled || !configuration.dailyBudgetUsd || !configuration.maxInputTokens || !configuration.maxOutputTokens || !price) return null;
  return (configuration.maxInputTokens * price.inputUsdPerMillion + configuration.maxOutputTokens * price.outputUsdPerMillion) / 1_000_000;
}

export async function reserveAiBudget(attemptId: string, estimatedUsd: number): Promise<boolean> {
  const configuration = await getAiConfiguration();
  if (!configuration.enabled || !configuration.dailyBudgetUsd || !Number.isFinite(estimatedUsd) || estimatedUsd < 0) return false;
  const estimatedMicros = BigInt(Math.ceil(estimatedUsd * 1_000_000));
  const limit = BigInt(Math.floor(configuration.dailyBudgetUsd * 1_000_000));
  const day = new Date().toISOString().slice(0, 10);
  return prisma.$transaction(async (transaction) => {
    if (await transaction.aiReservation.findUnique({ where: { id: attemptId } })) return false;
    await transaction.aiBudgetDay.upsert({ where: { day }, create: { day }, update: {} });
    const updated = await transaction.$executeRaw`UPDATE "AiBudgetDay" SET "reservedMicros" = "reservedMicros" + ${estimatedMicros}
      WHERE "day" = ${day} AND "spentMicros" + "reservedMicros" + ${estimatedMicros} <= ${limit}`;
    if (!updated) return false;
    await transaction.aiReservation.create({ data: { id: attemptId, day, estimatedMicros } });
    return true;
  });
}

export async function settleAiBudget(attemptId: string, actualUsd: number | null): Promise<void> {
  const known = actualUsd !== null && Number.isFinite(actualUsd) && actualUsd >= 0;
  await prisma.$transaction(async (transaction) => {
    const reservation = await transaction.aiReservation.findUniqueOrThrow({ where: { id: attemptId } });
    if (reservation.status !== 'reserved') return;
    const actualMicros = known ? BigInt(Math.ceil(actualUsd! * 1_000_000)) : null;
    const changed = await transaction.aiReservation.updateMany({ where: { id: attemptId, status: 'reserved' },
      data: { status: known ? 'settled' : 'unknown', actualMicros, settledAt: new Date() } });
    if (!changed.count) return;
    await transaction.aiBudgetDay.update({ where: { day: reservation.day }, data: known
      ? { spentMicros: { increment: actualMicros! }, reservedMicros: { decrement: reservation.estimatedMicros } }
      : { unknownCount: { increment: 1 } } });
  });
}