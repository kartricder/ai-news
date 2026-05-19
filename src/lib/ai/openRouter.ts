import { getAppSettings } from '@/lib/settings';

type Audience = 'developer' | 'manager' | 'business' | 'researcher' | 'security' | 'general';
type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export type ArticleAiResult = {
  titleVi: string;
  briefVi: string;
  whyImportant: string;
  aiTags: string[];
  targetAudience: Audience;
  impactLevel: ImpactLevel;
  languageNote?: string;
  provider: 'openrouter';
  model: string;
  status: 'success' | 'fallback_success';
};

export type RepoAiResult = {
  aiSummaryVi: string;
  whyImportant: string;
  provider: 'openrouter';
  model: string;
  status: 'success' | 'fallback_success';
};

type OpenRouterMessage = {
  role: 'system' | 'user';
  content: string;
};

type CompletionResponse = {
  id?: string;
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; code?: string };
};

export class AiProcessingError extends Error {
  constructor(
    message: string,
    public readonly status: 'failed' | 'blocked' = 'failed',
    public readonly requestId?: string
  ) {
    super(message);
  }
}

function cleanJson(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = cleanJson(text);
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new AiProcessingError('JSON parse failed');
  }
}

function stringValue(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
}

async function callOpenRouter(model: string, messages: OpenRouterMessage[], timeoutMs: number): Promise<{ content: string; requestId?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AiProcessingError('OPENROUTER_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_BASE_URL || 'http://localhost:3000',
        'X-Title': 'AI News Viet Nam',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    const requestId = response.headers.get('x-request-id') || undefined;
    const data = (await response.json().catch(() => ({}))) as CompletionResponse;
    if (!response.ok) {
      const message = data.error?.message || `OpenRouter ${response.status}`;
      const blocked = /block|moderation|policy|safety/i.test(message);
      throw new AiProcessingError(message, blocked ? 'blocked' : 'failed', requestId || data.id);
    }

    const content = data.choices?.[0]?.message?.content?.trim() || '';
    if (!content) {
      throw new AiProcessingError('Empty response', 'failed', requestId || data.id);
    }
    return { content, requestId: requestId || data.id };
  } catch (error) {
    if (error instanceof AiProcessingError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiProcessingError('OpenRouter request timed out');
    }
    throw new AiProcessingError(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
}

async function callWithFallbacks(messages: OpenRouterMessage[]): Promise<{ json: Record<string, unknown>; model: string; status: 'success' | 'fallback_success' }> {
  const settings = await getAppSettings();
  const models = [
    settings.openrouter_model,
    settings.openrouter_fallback_model,
    settings.openrouter_second_fallback_model,
  ].filter(Boolean);
  const errors: string[] = [];

  for (const [index, model] of models.entries()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { content } = await callOpenRouter(model, messages, 45000);
        return {
          json: parseJsonObject(content),
          model,
          status: index === 0 ? 'success' : 'fallback_success',
        };
      } catch (error) {
        const aiError = error instanceof AiProcessingError ? error : new AiProcessingError(String(error));
        errors.push(`${model} attempt ${attempt}: ${aiError.message}`);
        if (aiError.status === 'blocked') break;
      }
    }
  }

  throw new AiProcessingError(errors.join(' | ') || 'OpenRouter failed');
}

export async function processArticleWithAI(input: {
  originalTitle: string;
  originalBrief: string;
  sourceName: string;
  sourceUrl: string;
  category: string;
  tags: string[];
}): Promise<ArticleAiResult> {
  const system = [
    'Ban la bien tap vien tin cong nghe AI tieng Viet.',
    'Nhiem vu: dich va bien tap title + brief cua tin cong nghe AI sang tieng Viet ngan gon, de hieu cho nguoi lam CNTT.',
    'Khong phong dai, khong them thong tin ngoai nguon, khong viet giat tit.',
    'Giu nguyen thuat ngu ky thuat pho bien neu can: AI, LLM, RAG, agent, benchmark, repo, API, open-source, inference, fine-tuning, multimodal.',
    'Output bat buoc la JSON hop le, khong markdown.',
  ].join(' ');

  const user = `Hay xu ly tin sau va tra ve JSON hop le, khong markdown.

Original title:
${input.originalTitle}

Original brief:
${input.originalBrief}

Source:
${input.sourceName}

URL:
${input.sourceUrl}

Category:
${input.category}

Tags:
${input.tags.join(', ')}

Yeu cau output:
{
  "titleVi": "toi da 90 ky tu",
  "briefVi": "toi da 450 ky tu, 2-3 cau",
  "whyImportant": "2-4 cau, tac dong thuc te voi developer/CNTT/doanh nghiep",
  "aiTags": ["...", "..."],
  "targetAudience": "developer | manager | business | researcher | security | general",
  "impactLevel": "low | medium | high | critical",
  "languageNote": "ghi chu ngan neu can"
}`;

  const result = await callWithFallbacks([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  const json = result.json;
  const titleVi = stringValue(json.titleVi, 90);
  const briefVi = stringValue(json.briefVi, 450);
  const whyImportant = stringValue(json.whyImportant, 800);

  if (!titleVi || !briefVi || !whyImportant) {
    throw new AiProcessingError('AI response missing required fields');
  }

  const targetAudience = stringValue(json.targetAudience, 30) as Audience;
  const impactLevel = stringValue(json.impactLevel, 20) as ImpactLevel;

  return {
    titleVi,
    briefVi,
    whyImportant,
    aiTags: stringArray(json.aiTags),
    targetAudience: ['developer', 'manager', 'business', 'researcher', 'security', 'general'].includes(targetAudience) ? targetAudience : 'general',
    impactLevel: ['low', 'medium', 'high', 'critical'].includes(impactLevel) ? impactLevel : 'medium',
    languageNote: stringValue(json.languageNote, 200),
    provider: 'openrouter',
    model: result.model,
    status: result.status,
  };
}

export async function summarizeRepoWithAI(input: {
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  topics: string[];
  url: string;
}): Promise<RepoAiResult> {
  const system = 'Ban la bien tap vien AI tieng Viet. Hay viet ngan gon, khong phong dai, khong them thong tin ngoai metadata repo.';
  const user = `Tra ve JSON hop le, khong markdown, cho repo GitHub AI sau:

Repo: ${input.fullName}
Description: ${input.description || 'N/A'}
Stars: ${input.stars}
Forks: ${input.forks}
Language: ${input.language || 'N/A'}
Topics: ${input.topics.join(', ')}
URL: ${input.url}

Output:
{
  "aiSummaryVi": "repo nay lam gi, toi da 350 ky tu",
  "whyImportant": "vi sao dang chu y va phu hop voi ai, 2-3 cau"
}`;

  const result = await callWithFallbacks([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]);
  const aiSummaryVi = stringValue(result.json.aiSummaryVi, 350);
  const whyImportant = stringValue(result.json.whyImportant, 700);
  if (!aiSummaryVi || !whyImportant) {
    throw new AiProcessingError('Repo AI response missing required fields');
  }
  return {
    aiSummaryVi,
    whyImportant,
    provider: 'openrouter',
    model: result.model,
    status: result.status,
  };
}
