import { ConfiguredSourceCrawler } from './ConfiguredSourceCrawler';

export class GitHubReleaseCrawler extends ConfiguredSourceCrawler {
  constructor() { super('github-release', 'GitHub Releases'); }
}