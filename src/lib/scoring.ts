export interface ArticleImportance {
  score: number;
  reason: string;
}

/**
 * Score the importance of an article on a 0-100 scale.
 * Uses multiple signals: source quality, content relevance, recency, and keyword matches.
 */
export function calculateImportance(article: {
  title: string;
  content: string;
  sourceName: string;
  sourceType: string;
  tags: string[];
  publishedAt: string | null;
}): ArticleImportance {
  let score = 0;
  const reasons: string[] = [];
  const lowerTitle = article.title.toLowerCase();
  const lowerContent = article.content.toLowerCase();
  const combined = lowerTitle + ' ' + lowerContent;

  // ===== 1. Source quality (0-20 points) =====
  const premiumSources = ['OpenAI Blog', 'Anthropic Blog', 'Google AI Blog', 'DeepMind Blog', 'Meta AI Blog'];
  const goodSources = ['GitHub Trending', 'Hacker News'];
  const standardSources = ['Reddit r/LocalLLaMA', 'Reddit r/MachineLearning', 'Reddit r/OpenAI'];

  if (premiumSources.includes(article.sourceName)) {
    score += 20;
    reasons.push('Premium source');
  } else if (goodSources.includes(article.sourceName)) {
    score += 12;
    reasons.push('Quality source');
  } else if (standardSources.includes(article.sourceName)) {
    score += 8;
    reasons.push('Standard source');
  }

  // ===== 2. Content relevance (0-40 points) =====
  // High-impact keywords (each worth 5 points, max 20)
  const highImpactKeywords = [
    'gpt-5', 'gpt5', 'claude 4', 'claude4', 'gemini 3', 'gemini3',
    'breakthrough', 'state-of-the-art', 'sota', 'outperforms',
    'agi', 'superintelligence', 'alignment', 'safety',
    'open source', 'open-source', 'release', 'launch',
  ];

  let highImpactCount = 0;
  for (const kw of highImpactKeywords) {
    if (combined.includes(kw)) {
      highImpactCount++;
      if (highImpactCount <= 4) {
        score += 5;
        reasons.push(`High-impact keyword: ${kw}`);
      }
    }
  }

  // Medium-impact keywords (each worth 2 points, max 10)
  const mediumKeywords = [
    'transformer', 'diffusion', 'attention', 'fine-tun', 'fine tun',
    'reasoning', 'benchmark', 'dataset', 'training',
    'performance', 'accuracy', 'efficiency', 'scalable',
  ];

  let mediumCount = 0;
  for (const kw of mediumKeywords) {
    if (combined.includes(kw)) {
      mediumCount++;
      if (mediumCount <= 5) {
        score += 2;
      }
    }
  }

  // Topic matching (max 10 points)
  const categories = ['llm', 'research', 'developer-tools', 'computer-vision'];
  const articleCategory = categorizeArticle(combined);
  if (categories.includes(articleCategory)) {
    score += 7;
    reasons.push(`Relevant category: ${articleCategory}`);
  }

  // ===== 3. Recency (0-20 points) =====
  if (article.publishedAt) {
    const publishedDate = new Date(article.publishedAt).getTime();
    const now = Date.now();
    const hoursAgo = (now - publishedDate) / (1000 * 60 * 60);

    if (hoursAgo < 6) {
      score += 20;
      reasons.push('Very recent (< 6h)');
    } else if (hoursAgo < 24) {
      score += 15;
      reasons.push('Recent (< 24h)');
    } else if (hoursAgo < 72) {
      score += 10;
      reasons.push('Moderately recent (< 72h)');
    } else if (hoursAgo < 168) {
      score += 5;
      reasons.push('Within a week');
    }
  } else {
    score += 5; // No date — give a baseline
  }

  // ===== 4. Quality signals (0-20 points) =====
  // Length bonus
  const wordCount = article.content.split(/\s+/).length;
  if (wordCount > 500) {
    score += 5;
    reasons.push('Detailed content');
  } else if (wordCount > 200) {
    score += 3;
  }

  // Title clarity (has meaningful words)
  const titleWords = article.title.split(/\s+/).length;
  if (titleWords >= 5 && titleWords <= 25) {
    score += 3;
    reasons.push('Clear title');
  }

  // Has technical details
  const techPatterns = [
    /\d+\.\d+/, /\d+%/,
    /\b(benchmark|accuracy|precision|recall|F1|BLEU|ROUGE)\b/,
  ];
  if (techPatterns.some((p) => p.test(combined))) {
    score += 5;
    reasons.push('Contains technical details');
  }

  // Original content (not just curated)
  if (article.sourceType === 'rss') {
    score += 5;
    reasons.push('Original content from blog');
  } else if (article.sourceType === 'github') {
    score += 3;
    reasons.push('Open source project');
  }

  // ===== Clamp and return =====
  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  return {
    score: finalScore,
    reason: reasons.length > 0 ? reasons.join('; ') : 'No specific signals detected',
  };
}

function categorizeArticle(text: string): string {
  if (/\b(llm|language model|gpt|claude|gemini)\b/.test(text)) return 'llm';
  if (/\b(computer vision|image generation|diffusion)\b/.test(text)) return 'computer-vision';
  if (/\b(reinforcement|rl|agent|robotics)\b/.test(text)) return 'reinforcement-learning';
  if (/\b(developer|api|tool|framework|library|sdk)\b/.test(text)) return 'developer-tools';
  if (/\b(ethics|safety|alignment|regulation|bias)\b/.test(text)) return 'ethics-safety';
  if (/\b(research|paper|arxiv|benchmark|dataset)\b/.test(text)) return 'research';
  if (/\b(business|startup|funding|investment|market)\b/.test(text)) return 'business';
  if (/\b(healthcare|medical|drug|diagnosis)\b/.test(text)) return 'healthcare';
  return 'general';
}
