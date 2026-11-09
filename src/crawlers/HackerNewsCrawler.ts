import { ConfiguredSourceCrawler } from './ConfiguredSourceCrawler';

export class HackerNewsCrawler extends ConfiguredSourceCrawler {
  constructor() { super('hackernews', 'Hacker News'); }
}