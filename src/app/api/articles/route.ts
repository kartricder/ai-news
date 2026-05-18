import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    const sortBy = (searchParams.get('sortBy') || 'createdAt') as string;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '12', 10)));
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.ArticleWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { summaryVi: { contains: search } },
        { sourceName: { contains: search } },
      ];
    }

    // Build orderBy
    const allowedSortFields = ['createdAt', 'importanceScore', 'publishedAt', 'title', 'sourceName'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.ArticleOrderByWithRelationInput = {
      [safeSortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    // Run count + find in parallel
    const [total, articles] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          slug: true,
          title: true,
          summaryVi: true,
          sourceName: true,
          category: true,
          importanceScore: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      data: articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('GET /api/articles error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
