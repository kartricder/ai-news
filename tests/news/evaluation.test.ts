import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluationCases, EVALUATION_CLOCK } from '../fixtures/news-eval/cases';
import { validateDataset, datasetHash, loadBaseline, evaluateDataset, mockSchemaRegression } from '../helpers/newsEvaluation';
import { scoreNews, selectCandidates } from '../../src/lib/news/rank';
import { normalizeNews, assessEvidence } from '../../src/lib/news/normalize';
import { getIdentityKey } from '../../src/lib/news/identity';
import { suggestCluster } from '../../src/lib/news/cluster';

test('T9 fixture cardinality, split and frozen content fingerprint', () => {
  validateDataset();
  assert.equal(datasetHash(), '10fade89e4838f859ce1c1c96b8b9a10cbe0226a58436adfe4e941518f236833');
});
test('same fixture and clock produce identical ranking and flags across repeated calls', () => {
  for (const entry of evaluationCases) {
    const item = normalizeNews(entry.item);
    const expected = scoreNews(item, { clock: new Date(EVALUATION_CLOCK), sourceKind: entry.sourceKind });
    for (let attempt = 0; attempt < 4; attempt++) assert.deepEqual(scoreNews(item, { clock: new Date(EVALUATION_CLOCK), sourceKind: entry.sourceKind }), expected);
  }
});
test('all fixed pair identities and conservative cluster suggestions match provisional labels', () => {
  for (const entry of evaluationCases.filter((entry) => entry.pair)) {
    const other = entry.pair!;
    assert.equal(getIdentityKey(entry.item) === getIdentityKey(other.item), other.duplicate, entry.id);
    assert.equal(suggestCluster(normalizeNews(other.item), [{ clusterId: 'fixture', item: normalizeNews(entry.item) }]).clusterId === 'fixture', other.sameEvent, entry.id);
  }
});
test('top-10 selection enforces publisher and community quotas without mutating backlog', () => {
  const item = normalizeNews(evaluationCases[0].item);
  const candidates = Array.from({ length: 30 }, (_, index) => ({ item, breakdown: { ...scoreNews(item, { clock: new Date(EVALUATION_CLOCK), sourceKind: 'official' }), total: 99 - index },
    eligibleForAI: true, sourceKind: index < 8 ? 'community' as const : 'official' as const, publisherKey: index < 8 ? `community-${index}` : `publisher-${Math.floor((index - 8) / 5)}` }));
  const selected = selectCandidates(candidates, { limit: 10, threshold: 75, perPublisher: 2, community: 3 });
  assert.ok(selected.length <= 10 && selected.length > 0);
  assert.ok(selected.filter((entry) => entry.sourceKind === 'community').length <= 3);
  for (const publisher of new Set(selected.map((entry) => entry.publisherKey))) assert.ok(selected.filter((entry) => entry.publisherKey === publisher).length <= 2);
  assert.equal(candidates.length, 30);
});
test('invalid evidence/date/injection cases require review and never pass automatic selection', () => {
  for (const entry of evaluationCases.filter((entry) => entry.group === 'edges')) {
    const item = normalizeNews(entry.item);
    assert.equal(assessEvidence(item).requiresReview, true, entry.id);
    assert.equal(selectCandidates([{ item, breakdown: scoreNews(item, { clock: new Date(EVALUATION_CLOCK), sourceKind: entry.sourceKind }), eligibleForAI: true, publisherKey: entry.id, sourceKind: entry.sourceKind }], { limit: 1, threshold: 75, perPublisher: 2, community: 3 }).length, 0, entry.id);
  }
});
test('mock schema/quality regression checks succeed without a provider', () => {
  for (const result of mockSchemaRegression()) assert.equal(result.passed, true, `${result.name}: ${'error' in result ? result.error : ''}`);
});
test('evaluation reports denominator counts and preserves failed quality gates', () => {
  const baseline = loadBaseline();
  const after = evaluateDataset(baseline, 'after');
  assert.equal(after.holdout.cases, 40);
  assert.equal(after.holdout.singleCases, 33);
  assert.equal(after.holdout.pairCases, 7);
  assert.equal(after.holdout.importantRecall.denominator, 16);
  assert.equal(after.gates.importantRecall, false);
  assert.equal(after.gates.liveSchema98Percent, null);
});