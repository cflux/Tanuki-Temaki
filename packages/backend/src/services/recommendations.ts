import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger.js';

const prisma = new PrismaClient();

export interface RecommendedSeries {
  series: {
    id: string;
    title: string;
    url: string;
    mediaType: string;
    titleImage: string | null;
    rating: number | null;
    tags: Array<{ value: string; category: string | null }>;
  };
  score: number;
  matchedTags: string[];
  basedOnTitles: string[];
}

export class RecommendationService {
  static async getRecommendations(userId: string): Promise<RecommendedSeries[]> {
    // Step 1: Get user's highly rated series (4-5 stars), sorted by rating desc, take top 5 as seeds
    const topRatings = await prisma.userSeriesRating.findMany({
      where: {
        userId,
        rating: { gte: 4 },
      },
      orderBy: { rating: 'desc' },
      take: 5,
      include: {
        series: {
          include: { tags: true },
        },
      },
    });

    if (topRatings.length === 0) {
      return [];
    }

    const seedSeriesIds = topRatings.map((r) => r.seriesId);
    const seedTitles = Object.fromEntries(topRatings.map((r) => [r.seriesId, r.series.title]));

    // Step 2: Get user's upvoted tags (net vote > 0), grouped by tag value
    const tagVotes = await prisma.userTagVote.findMany({
      where: { userId },
    });

    // Aggregate tag votes: sum votes per tag value
    const tagScoreMap = new Map<string, number>();
    for (const vote of tagVotes) {
      const current = tagScoreMap.get(vote.tagValue) ?? 0;
      tagScoreMap.set(vote.tagValue, current + vote.vote);
    }
    // Keep only tags with net positive vote
    const preferredTags = new Map<string, number>(
      [...tagScoreMap.entries()].filter(([, score]) => score > 0)
    );

    // Step 3: Get all already-rated and watchlisted series for the user to exclude
    const [alreadyRated, watchlisted] = await Promise.all([
      prisma.userSeriesRating.findMany({ where: { userId }, select: { seriesId: true } }),
      prisma.userWatchlist.findMany({ where: { userId }, select: { seriesId: true } }),
    ]);

    const excludeIds = new Set([
      ...alreadyRated.map((r) => r.seriesId),
      ...watchlisted.map((w) => w.seriesId),
    ]);

    // Step 4: Find depth-1 neighbours of seed series via Relationship table
    const relationships = await prisma.relationship.findMany({
      where: {
        OR: [
          { fromSeriesId: { in: seedSeriesIds } },
          { toSeriesId: { in: seedSeriesIds } },
        ],
      },
    });

    // Map candidate series ID → which seeds it relates to
    const candidateToSeeds = new Map<string, Set<string>>();
    for (const rel of relationships) {
      const [seedId, candidateId] = seedSeriesIds.includes(rel.fromSeriesId)
        ? [rel.fromSeriesId, rel.toSeriesId]
        : [rel.toSeriesId, rel.fromSeriesId];

      if (!excludeIds.has(candidateId)) {
        if (!candidateToSeeds.has(candidateId)) {
          candidateToSeeds.set(candidateId, new Set());
        }
        candidateToSeeds.get(candidateId)!.add(seedId);
      }
    }

    if (candidateToSeeds.size === 0) {
      return [];
    }

    // Step 5: Fetch candidate series with tags
    const candidateIds = [...candidateToSeeds.keys()];
    const candidateSeries = await prisma.series.findMany({
      where: { id: { in: candidateIds } },
      include: { tags: true },
    });

    // Step 6: Score each candidate
    const scored: RecommendedSeries[] = candidateSeries.map((series) => {
      const seriesTags = series.tags.map((t) => t.value);
      const matchedTags: string[] = [];
      let tagScore = 0;

      for (const tag of seriesTags) {
        const voteScore = preferredTags.get(tag);
        if (voteScore !== undefined) {
          tagScore += voteScore;
          matchedTags.push(tag);
        }
      }

      const anilistBonus = series.rating != null ? series.rating / 10 : 0;
      const totalScore = tagScore + anilistBonus;

      const seedIds = [...(candidateToSeeds.get(series.id) ?? new Set())];
      const basedOnTitles = seedIds
        .map((id) => seedTitles[id])
        .filter(Boolean);

      return {
        series: {
          id: series.id,
          title: series.title,
          url: series.url,
          mediaType: series.mediaType,
          titleImage: series.titleImage ?? null,
          rating: series.rating ?? null,
          tags: series.tags.map((t) => ({ value: t.value, category: t.category })),
        },
        score: totalScore,
        matchedTags,
        basedOnTitles,
      };
    });

    // Step 7: Sort by score desc, return top 10
    scored.sort((a, b) => b.score - a.score);

    logger.info('Generated recommendations', {
      userId,
      seedCount: seedSeriesIds.length,
      candidateCount: candidateSeries.length,
      resultCount: Math.min(scored.length, 10),
    });

    return scored.slice(0, 10);
  }
}
