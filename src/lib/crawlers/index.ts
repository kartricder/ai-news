export interface CrawledArticle {
  title: string;
  content: string;
  url: string;
  publishedAt: string | null;
  sourceName: string;
  sourceType: string;
  category: string;
  tags: string[];
}

export interface ScoredArticle extends CrawledArticle {
  score: number;
  reason: string;
}

export async function crawlSource(source: {
  name: string;
  type: string;
  url: string;
  configJson?: string;
}): Promise<CrawledArticle[]> {
  let articles: CrawledArticle[] = [];

  try {
    switch (source.type) {
      case 'rss':
        articles = await crawlRSS(source);
        break;
      case 'github':
        articles = await crawlGitHub(source);
        break;
      case 'hackernews':
        articles = await crawlHackerNews(source);
        break;
      case 'reddit':
        articles = await crawlReddit(source);
        break;
      default:
        console.warn(`Unknown source type: ${source.type}`);
    }
  } catch (error) {
    console.error(`Error crawling ${source.name}:`, error);
    throw error;
  }

  return articles;
}

async function crawlRSS(source: {
  name: string;
  url: string;
}): Promise<CrawledArticle[]> {
  const response = await fetch(source.url);
  const xml = await response.text();

  // Simple XML parser — in production use a proper RSS parser
  const articles: CrawledArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const title = extractXmlTag(item, 'title');
    const link = extractXmlTag(item, 'link');
    const description = extractXmlTag(item, 'description') || '';
    const pubDate = extractXmlTag(item, 'pubDate');
    const contentEncoded = extractXmlTagWithNamespace(item, 'content:encoded');

    if (title && link) {
      articles.push({
        title: decodeHtmlEntities(title),
        content: decodeHtmlEntities(contentEncoded || description),
        url: link,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
        sourceName: source.name,
        sourceType: 'rss',
        category: classifyArticle(title + ' ' + description),
        tags: extractTags(title + ' ' + description),
      });
    }
  }

  return articles;
}

async function crawlGitHub(source: {
  name: string;
  url: string;
}): Promise<CrawledArticle[]> {
  const response = await fetch(source.url, {
    headers: { Accept: 'application/json', 'User-Agent': 'AI-News-Aggregator' },
  });
  const data = await response.json();

  const articles: CrawledArticle[] = [];
  const repos = data.items || [];

  for (const repo of repos.slice(0, 15)) {
    const title = `${repo.full_name}: ${repo.description || 'No description'}`;
    const content = `Repository: ${repo.full_name}
Stars: ${repo.stargazers_count}
Language: ${repo.language || 'N/A'}
Description: ${repo.description || 'No description'}
Topics: ${(repo.topics || []).join(', ')}`;

    articles.push({
      title,
      content,
      url: repo.html_url,
      publishedAt: repo.created_at,
      sourceName: source.name,
      sourceType: 'github',
      category: 'developer-tools',
      tags: ['github', ...(repo.topics || []), repo.language].filter(Boolean),
    });
  }

  return articles;
}

async function crawlHackerNews(source: {
  name: string;
  url: string;
}): Promise<CrawledArticle[]> {
  const response = await fetch(source.url, {
    headers: { Accept: 'application/json', 'User-Agent': 'AI-News-Aggregator' },
  });
  const data = await response.json();

  const articles: CrawledArticle[] = [];
  const hits = data.hits || [];

  for (const hit of hits.slice(0, 20)) {
    if (!hit.title) continue;

    articles.push({
      title: hit.title,
      content: hit.story_text || hit.comment_text || `Hacker News story by ${hit.author || 'unknown'} with ${hit.points || 0} points.`,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      publishedAt: hit.created_at || null,
      sourceName: source.name,
      sourceType: 'hackernews',
      category: classifyArticle(hit.title + ' ' + hit.story_text),
      tags: ['hacker-news', ...extractTags(hit.title)],
    });
  }

  return articles;
}

async function crawlReddit(source: {
  name: string;
  url: string;
}): Promise<CrawledArticle[]> {
  const response = await fetch(source.url, {
    headers: { Accept: 'application/json', 'User-Agent': 'AI-News-Aggregator/1.0' },
  });
  const data = await response.json();

  const articles: CrawledArticle[] = [];
  const children = data.data?.children || [];

  for (const child of children.slice(0, 20)) {
    const post = child.data;
    if (!post || post.is_self === false && !post.url) continue;
    if (!post.title) continue;

    articles.push({
      title: post.title,
      content: post.selftext || `Reddit post by ${post.author} in ${post.subreddit_name_prefixed} — ups: ${post.ups}, comments: ${post.num_comments}`,
      url: post.url || `https://reddit.com${post.permalink}`,
      publishedAt: new Date(post.created_utc * 1000).toISOString(),
      sourceName: source.name,
      sourceType: 'reddit',
      category: classifyArticle(post.title + ' ' + (post.link_flair_text || '')),
      tags: ['reddit', post.subreddit?.toLowerCase() || '', ...extractTags(post.title)],
    });
  }

  return articles;
}

// ===== Helpers =====

function extractXmlTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function extractXmlTagWithNamespace(xml: string, tag: string): string | null {
  // Handle namespaced tags like <content:encoded>
  const escapedTag = tag.replace(':', '\\:');
  const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/<[^>]*>/g, '')
    .trim();
}

function classifyArticle(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(llm|language model|gpt|claude|gemini|transformers)\b/.test(lower)) return 'llm';
  if (/\b(computer vision|image generation|diffusion|object detection|segmentation)\b/.test(lower)) return 'computer-vision';
  if (/\b(reinforcement|rl|reward|agent|robotics|control)\b/.test(lower)) return 'reinforcement-learning';
  if (/\b(developer|api|tool|framework|library|sdk|plugin|extension)\b/.test(lower)) return 'developer-tools';
  if (/\b(ethics|safety|alignment|regulation|bias|policy)\b/.test(lower)) return 'ethics-safety';
  if (/\b(research|paper|arxiv|benchmark|dataset|evaluation)\b/.test(lower)) return 'research';
  if (/\b(business|startup|funding|investment|market|revenue|ipo)\b/.test(lower)) return 'business';
  if (/\b(healthcare|medical|drug|diagnosis|protein|genomics)\b/.test(lower)) return 'healthcare';
  return 'general';
}

function extractTags(text: string): string[] {
  // Extract capitalized words and AI-related keywords as tags
  const aiKeywords = ['AI', 'ML', 'LLM', 'NLP', 'GPT', 'RAG', 'CNN', 'RNN', 'API', 'SDK', 'GPU', 'TPU'];
  const found = aiKeywords.filter((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(text));
  return [...new Set(found)];
}
