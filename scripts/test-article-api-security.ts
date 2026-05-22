import { prisma } from '../src/lib/prisma';

const baseUrl = process.env.API_TEST_BASE_URL || 'http://127.0.0.1:3000';

type CheckResult = {
  name: string;
  actual: number;
  expected: string;
  pass: boolean;
};

async function request(path: string, init?: RequestInit) {
  return fetch(new URL(path, baseUrl), init);
}

function expectStatus(name: string, actual: number, expected: number | number[]): CheckResult {
  const expectedStatuses = Array.isArray(expected) ? expected : [expected];
  return {
    name,
    actual,
    expected: expectedStatuses.join(' or '),
    pass: expectedStatuses.includes(actual),
  };
}

async function main() {
  const [published, pending] = await Promise.all([
    prisma.article.findFirst({
      where: { status: 'published' },
      select: { slug: true },
    }),
    prisma.article.findFirst({
      where: { status: 'pending' },
      select: { slug: true },
    }),
  ]);

  if (!published || !pending) {
    throw new Error('API security regression needs one published and one pending article in the current database.');
  }

  const [publishedDetail, pendingDetail, pendingAdminDetail, pendingList, unauthPatch] = await Promise.all([
    request(`/api/articles/${published.slug}`),
    request(`/api/articles/${pending.slug}`),
    request(`/api/articles/${pending.slug}/admin`),
    request('/api/articles?status=pending&pageSize=1'),
    request(`/api/articles/${published.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    }),
  ]);

  const checks = [
    expectStatus('GET published public detail', publishedDetail.status, 200),
    expectStatus('GET pending public detail', pendingDetail.status, 404),
    expectStatus('GET pending admin detail without auth', pendingAdminDetail.status, [401, 404]),
    expectStatus('GET pending list without auth', pendingList.status, 401),
    expectStatus('PATCH article without auth', unauthPatch.status, 401),
  ];

  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${check.actual} (expected ${check.expected})`);
  }

  if (checks.some((check) => !check.pass)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
