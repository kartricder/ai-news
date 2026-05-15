// Scoring engine for AI news
// Scores articles from 0-100 based on importance

interface ScoreContext {
  sourceName: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  originalPublishedAt?: Date;
}

// High-impact keywords/phrases (adds points)
const MAJOR_KEYWORDS: { pattern: RegExp; points: number; reason: string }[] = [
  // Model releases & architecture
  { pattern: /\bgpt-?5\b/gi, points: 20, reason: 'GPT-5 là bước đột phá lớn trong AI' },
  { pattern: /\bgpt-?4\.?\d?\b/gi, points: 10, reason: 'Phiên bản mới của GPT là tin quan trọng' },
  { pattern: /\bclaude-?4\b/gi, points: 15, reason: 'Claude 4 là sự kiện lớn từ Anthropic' },
  { pattern: /\bclaude-?3\.?\d?\b/gi, points: 10, reason: 'Phiên bản Claude mới' },
  { pattern: /\bgemini-?2\.?\d?\b/gi, points: 10, reason: 'Gemini mới từ Google DeepMind' },
  { pattern: /\bgemini\s+ultra\b/gi, points: 12, reason: 'Gemini Ultra là mô hình mạnh nhất của Google' },
  { pattern: /\bllama-?4?\b/gi, points: 15, reason: 'Meta Llama mới là tin quan trọng' },
  { pattern: /\bllama-?3\.?\d?\b/gi, points: 8, reason: 'Phiên bản Llama cập nhật' },
  { pattern: /\bgrok-?3?\b/gi, points: 8, reason: 'xAI Grok mới' },
  { pattern: /\bdeepseek-?[rv]\d*\b/gi, points: 10, reason: 'DeepSeek mới từ Trung Quốc' },
  { pattern: /\bmistral\s+(large|medium|small)\b/gi, points: 8, reason: 'Mistral AI phát hành mô hình mới' },
  { pattern: /\bqwen\s*2\.?\d?\b/gi, points: 7, reason: 'Alibaba Qwen mới' },
  { pattern: /\byi-?(lightning|large)\b/gi, points: 6, reason: '01.AI Yi mới' },
  
  // Breakthroughs
  { pattern: /\bbi[tg]\s+breakthrough\b/gi, points: 15, reason: 'Đột phá công nghệ AI lớn' },
  { pattern: /\breasoning\s+(model|engine)\b/gi, points: 12, reason: 'Mô hình reasoning mới rất quan trọng' },
  { pattern: /\barc\s+(challenge|prize|agi)\b/gi, points: 10, reason: 'ARC Challenge là benchmark quan trọng' },
  { pattern: /\bopen\s+source\s+(model|llm|ai)\b/gi, points: 8, reason: 'Mô hình open source là tin nóng' },
  { pattern: /\b(rlhf|dpo|rlvr)\b/gi, points: 6, reason: 'Kỹ thuật alignment mới' },
  { pattern: /\bagent(ic)?\s+(ai|system|framework)\b/gi, points: 8, reason: 'AI Agent là xu hướng hot' },
  { pattern: /\b(multi-?modal|vision|image\s+generation)\b/gi, points: 6, reason: 'Multimodal AI đang phát triển mạnh' },
  
  // Industry milestones
  { pattern: /\brecords?\s+(revenue|funding|valuation)\b/gi, points: 10, reason: 'Kỷ lục tài chính trong AI' },
  { pattern: /\b(acquisition|merger|ipo)\b/gi, points: 8, reason: 'Thương vụ M&A AI lớn' },
  { pattern: /\bregulation\s+(act|bill|law|policy)\b/gi, points: 10, reason: 'Chính sách quản lý AI quan trọng' },
  { pattern: /\b(safety|alignment|governance)\b/gi, points: 6, reason: 'An toàn AI là chủ đề quan trọng' },
  { pattern: /\b(humanity's\s+last\s+exam|mmlu|human\s+eval|swe-?bench)\b/gi, points: 7, reason: 'Benchmark AI quan trọng' },
  { pattern: /\b(training\s+cluster|data\s+center|h100|b200|gb200)\b/gi, points: 5, reason: 'Hạ tầng AI quy mô lớn' },
  
  // Vietnamese AI
  { pattern: /\b(vi?etnamese?\s+(ai|llm|nlp|model))\b/gi, points: 15, reason: 'AI tiếng Việt rất quan trọng với độc giả' },
  { pattern: /\b(vinai|vinbigdata|vbee|fpt\s+ai)\b/gi, points: 10, reason: 'AI Việt Nam nổi bật' },
];

// High-value sources
const HIGH_VALUE_SOURCES: { pattern: RegExp; points: number }[] = [
  { pattern: /\bOpenAI\b/i, points: 8 },
  { pattern: /\bAnthropic\b/i, points: 8 },
  { pattern: /\bGoogle\s*(AI|DeepMind)\b/i, points: 7 },
  { pattern: /\bMeta\s*(AI)?\b/i, points: 6 },
  { pattern: /\bDeepMind\b/i, points: 7 },
  { pattern: /\bMicrosoft\s+(AI|Research)\b/i, points: 5 },
  { pattern: /\bHugging\s+Face\b/i, points: 5 },
  { pattern: /\bxAI\b/i, points: 5 },
];

// Penalty patterns (reduces points)
const PENALTY_PATTERNS: { pattern: RegExp; points: number; reason: string }[] = [
  { pattern: /\b(tutorial|how\s+to|guide|beginner)\b/gi, points: -10, reason: 'Bài hướng dẫn cơ bản, ít tin tức' },
  { pattern: /\b(job|career|salary|interview)\b/gi, points: -5, reason: 'Chủ đề việc làm, không phải tin AI cốt lõi' },
  { pattern: /\b(opini[o]n|thoughts?|perspective)\b/gi, points: -8, reason: 'Bài viết quan điểm cá nhân' },
  { pattern: /\b(spam|clickbait|you\s+won't\s+believe)\b/gi, points: -20, reason: 'Clickbait, chất lượng thấp' },
  { pattern: /\b(advertisement|sponsored|promotion)\b/gi, points: -15, reason: 'Bài quảng cáo' },
  { pattern: /\b(rumor|speculation|unconfirmed)\b/gi, points: -10, reason: 'Tin đồn chưa xác nhận' },
];

// Category scoring
const CATEGORY_SCORES: Record<string, number> = {
  'model-release': 15,
  'breakthrough': 15,
  'research': 8,
  'industry': 5,
  'policy': 8,
  'tool-release': 5,
  'tutorial': -5,
  'opinion': -5,
};

export function calculateScore(context: ScoreContext): { score: number; reasons: string[] } {
  let score = 40; // Base score
  const reasons: string[] = [];

  // 1. Check major keywords in title (weighted higher)
  for (const kw of MAJOR_KEYWORDS) {
    const titleMatches = (context.title.match(kw.pattern) || []).length;
    const contentMatches = (context.content.match(kw.pattern) || []).length;
    const totalMatches = titleMatches + contentMatches;
    
    if (totalMatches > 0) {
      const points = kw.points * (1 + titleMatches * 0.5); // Title mentions are worth more
      score += points;
      reasons.push(`${kw.reason} (+${Math.round(points)})`);
    }
  }

  // 2. Check source value
  for (const src of HIGH_VALUE_SOURCES) {
    if (src.pattern.test(context.sourceName)) {
      score += src.points;
      reasons.push(`Nguồn tin uy tín: ${context.sourceName} (+${src.points})`);
      break;
    }
  }

  // 3. Apply penalties
  const fullText = `${context.title} ${context.content} ${context.tags.join(' ')}`;
  for (const penalty of PENALTY_PATTERNS) {
    if (penalty.pattern.test(fullText)) {
      score += penalty.points;
      reasons.push(`${penalty.reason} (${penalty.points})`);
    }
  }

  // 4. Category bonus
  if (CATEGORY_SCORES[context.category]) {
    score += CATEGORY_SCORES[context.category];
    reasons.push(`Thể loại: ${context.category} (${CATEGORY_SCORES[context.category] > 0 ? '+' : ''}${CATEGORY_SCORES[context.category]})`);
  }

  // 5. Recency bonus (published within last 2 days)
  if (context.originalPublishedAt) {
    const hoursAgo = (Date.now() - context.originalPublishedAt.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 24) {
      score += 5;
      reasons.push('Tin mới trong 24h (+5)');
    } else if (hoursAgo < 48) {
      score += 3;
      reasons.push('Tin trong 48h (+3)');
    }
  }

  // 6. Vietnamese relevance bonus
  const vietnamesePattern = /\b(tiếng\s+việt|vi?etnamese|AI\s+Việt)\b/gi;
  if (vietnamesePattern.test(fullText)) {
    score += 10;
    reasons.push('Liên quan AI tiếng Việt (+10)');
  }

  // Clamp score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  
  return { score: finalScore, reasons };
}
