import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Create a new crawl run record
    const crawlRun = await prisma.crawlRun.create({
      data: {
        status: 'running',
      },
    });

    // In a real app, this would trigger an async crawl job.
    // For now, we simulate a brief crawl and mark it complete.

    // Simulate fetching articles from enabled sources
    const enabledSources = await prisma.source.findMany({
      where: { enabled: true },
    });

    // Log crawl result (mock — no actual fetching yet)
    const mockFetched = enabledSources.length * 2;
    const mockPublished = Math.floor(mockFetched * 0.6);
    const mockPending = Math.floor(mockFetched * 0.2);
    const mockRejected = mockFetched - mockPublished - mockPending;

    const updatedRun = await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        totalFetched: mockFetched,
        totalPublished: mockPublished,
        totalPending: mockPending,
        totalRejected: mockRejected,
      },
    });

    return NextResponse.json({
      data: updatedRun,
      message: `Crawl completed. Fetched ${mockFetched} articles from ${enabledSources.length} sources.`,
    });
  } catch (error) {
    console.error('POST /api/crawl/trigger error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return recent crawl runs
    const runs = await prisma.crawlRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ data: runs });
  } catch (error) {
    console.error('GET /api/crawl/trigger error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
