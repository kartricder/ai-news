import { ConfiguredSourceCrawler } from './ConfiguredSourceCrawler';

export class RSSCrawler extends ConfiguredSourceCrawler {
  constructor() { super('rss', 'RSS Blogs'); }
}