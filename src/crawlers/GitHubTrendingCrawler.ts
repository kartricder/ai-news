import { ConfiguredSourceCrawler } from './ConfiguredSourceCrawler';

export class GitHubTrendingCrawler extends ConfiguredSourceCrawler {
  constructor() { super('github', 'GitHub Repository Discovery'); }
}