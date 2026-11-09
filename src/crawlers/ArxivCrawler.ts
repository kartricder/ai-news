import { ConfiguredSourceCrawler } from './ConfiguredSourceCrawler';

export class ArxivCrawler extends ConfiguredSourceCrawler {
  constructor() { super('arxiv', 'arXiv Abstracts'); }
}