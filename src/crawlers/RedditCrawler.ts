import { ConfiguredSourceCrawler } from './ConfiguredSourceCrawler';

export class RedditCrawler extends ConfiguredSourceCrawler {
  constructor() { super('reddit', 'Reddit'); }
}