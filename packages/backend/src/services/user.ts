import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class UserService {
  // ==================== RATINGS ====================

  /**
   * Rate a series (0-5)
   */
  static async rateSeries(userId: string, seriesId: string, rating: number) {
    if (rating < 0 || rating > 5) {
      throw new Error('Rating must be between 0 and 5');
    }

    return prisma.userSeriesRating.upsert({
      where: {
        userId_seriesId: { userId, seriesId },
      },
      update: { rating },
      create: {
        userId,
        seriesId,
        rating,
      },
    });
  }

  /**
   * Get user's rating for a series
   */
  static async getUserRating(userId: string, seriesId: string) {
    return prisma.userSeriesRating.findUnique({
      where: {
        userId_seriesId: { userId, seriesId },
      },
    });
  }

  /**
   * Get all ratings by a user
   */
  static async getAllRatings(userId: string) {
    return prisma.userSeriesRating.findMany({
      where: { userId },
      include: {
        series: {
          select: {
            id: true,
            title: true,
            titleImage: true,
            url: true,
            mediaType: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Delete a rating
   */
  static async deleteRating(userId: string, seriesId: string) {
    return prisma.userSeriesRating.delete({
      where: {
        userId_seriesId: { userId, seriesId },
      },
    });
  }

  /**
   * Get ratings map for multiple series (for efficient lookups)
   */
  static async getRatingsMap(userId: string, seriesIds: string[]): Promise<Map<string, number>> {
    const ratings = await prisma.userSeriesRating.findMany({
      where: {
        userId,
        seriesId: { in: seriesIds },
      },
      select: {
        seriesId: true,
        rating: true,
      },
    });

    return new Map(ratings.map((r) => [r.seriesId, r.rating]));
  }

  // ==================== NOTES ====================

  /**
   * Save a note for a series
   */
  static async saveNote(userId: string, seriesId: string, note: string) {
    return prisma.userSeriesNote.upsert({
      where: {
        userId_seriesId: { userId, seriesId },
      },
      update: { note },
      create: {
        userId,
        seriesId,
        note,
      },
    });
  }

  /**
   * Get user's note for a series
   */
  static async getNote(userId: string, seriesId: string) {
    return prisma.userSeriesNote.findUnique({
      where: {
        userId_seriesId: { userId, seriesId },
      },
    });
  }

  /**
   * Delete a note
   */
  static async deleteNote(userId: string, seriesId: string) {
    return prisma.userSeriesNote.delete({
      where: {
        userId_seriesId: { userId, seriesId },
      },
    });
  }

  // ==================== TAG VOTING ====================

  /**
   * Vote on a tag for a series (1 = upvote, -1 = downvote)
   */
  static async voteOnTag(userId: string, seriesId: string, tagValue: string, vote: 1 | -1) {
    return prisma.userTagVote.upsert({
      where: {
        userId_seriesId_tagValue: { userId, seriesId, tagValue },
      },
      update: { vote },
      create: {
        userId,
        seriesId,
        tagValue,
        vote,
      },
    });
  }

  /**
   * Remove tag vote
   */
  static async removeTagVote(userId: string, seriesId: string, tagValue: string) {
    return prisma.userTagVote.delete({
      where: {
        userId_seriesId_tagValue: { userId, seriesId, tagValue },
      },
    });
  }

  /**
   * Get all tag votes for a series
   */
  static async getSeriesTagVotes(userId: string, seriesId: string) {
    return prisma.userTagVote.findMany({
      where: { userId, seriesId },
    });
  }

  /**
   * Get user's global tag preferences (aggregated across all series)
   */
  static async getUserTagPreferences(userId: string): Promise<Map<string, number>> {
    const votes = await prisma.userTagVote.findMany({
      where: { userId },
      select: {
        tagValue: true,
        vote: true,
      },
    });

    // Aggregate votes by tag
    const tagScores = new Map<string, number>();
    for (const vote of votes) {
      const current = tagScores.get(vote.tagValue) || 0;
      tagScores.set(vote.tagValue, current + vote.vote);
    }

    return tagScores;
  }

  /**
   * Get tag votes map for multiple series (for efficient lookups)
   */
  static async getTagVotesMap(userId: string, seriesIds: string[]): Promise<Map<string, Map<string, number>>> {
    const votes = await prisma.userTagVote.findMany({
      where: {
        userId,
        seriesId: { in: seriesIds },
      },
      select: {
        seriesId: true,
        tagValue: true,
        vote: true,
      },
    });

    const votesMap = new Map<string, Map<string, number>>();
    for (const vote of votes) {
      if (!votesMap.has(vote.seriesId)) {
        votesMap.set(vote.seriesId, new Map());
      }
      votesMap.get(vote.seriesId)!.set(vote.tagValue, vote.vote);
    }

    return votesMap;
  }

  // ==================== PREFERENCES ====================

  /**
   * Set a preference
   */
  static async setPreference(userId: string, key: string, value: any) {
    return prisma.userPreference.upsert({
      where: {
        userId_key: { userId, key },
      },
      update: { value },
      create: {
        userId,
        key,
        value,
      },
    });
  }

  /**
   * Get a preference
   */
  static async getPreference(userId: string, key: string) {
    const pref = await prisma.userPreference.findUnique({
      where: {
        userId_key: { userId, key },
      },
    });
    return pref?.value;
  }

  /**
   * Get all preferences
   */
  static async getAllPreferences(userId: string) {
    const prefs = await prisma.userPreference.findMany({
      where: { userId },
    });

    // Convert to key-value map
    const prefsMap: Record<string, any> = {};
    for (const pref of prefs) {
      prefsMap[pref.key] = pref.value;
    }
    return prefsMap;
  }

  /**
   * Set available services
   */
  static async setAvailableServices(userId: string, services: string[]) {
    return this.setPreference(userId, 'available_services', services);
  }

  /**
   * Normalize service names to canonical versions
   */
  private static normalizeServiceName(name: string): string {
    const lower = name.toLowerCase();

    // Amazon variations
    if (lower.includes('amazon') || lower === 'prime video') {
      return 'Amazon Prime Video';
    }
    // Crunchyroll variations
    if (lower.includes('crunchyroll') && !lower.includes('manga')) {
      return 'Crunchyroll';
    }
    if (lower.includes('crunchyroll') && lower.includes('manga')) {
      return 'Crunchyroll Manga';
    }
    // HBO variations
    if (lower.includes('hbo')) {
      return 'HBO Max';
    }
    // Return original if no normalization needed
    return name;
  }

  /**
   * Get available services
   */
  static async getAvailableServices(userId: string): Promise<string[]> {
    const services = await this.getPreference(userId, 'available_services');
    if (!services || !Array.isArray(services)) {
      return [];
    }
    // Normalize service names to match current canonical names
    return services.map(s => this.normalizeServiceName(s));
  }

  // ==================== WATCHLIST ====================

  /**
   * Add series to watchlist
   */
  static async addToWatchlist(userId: string, seriesId: string, status: string = 'plan_to_watch') {
    return prisma.userWatchlist.upsert({
      where: {
        userId_seriesId: {
          userId,
          seriesId,
        },
      },
      update: {
        status,
        updatedAt: new Date(),
      },
      create: {
        userId,
        seriesId,
        status,
      },
    });
  }

  /**
   * Remove series from watchlist
   */
  static async removeFromWatchlist(userId: string, seriesId: string) {
    return prisma.userWatchlist.delete({
      where: {
        userId_seriesId: {
          userId,
          seriesId,
        },
      },
    });
  }

  /**
   * Get user's watchlist with series details
   */
  static async getWatchlist(userId: string) {
    return prisma.userWatchlist.findMany({
      where: { userId },
      include: {
        series: true,
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  /**
   * Get watchlist status for a specific series
   */
  static async getWatchlistStatus(userId: string, seriesId: string) {
    const item = await prisma.userWatchlist.findUnique({
      where: {
        userId_seriesId: {
          userId,
          seriesId,
        },
      },
    });
    return item ? { status: item.status, addedAt: item.addedAt } : null;
  }

  /**
   * Get all rated series with details
   */
  static async getRatedSeries(userId: string) {
    return prisma.userSeriesRating.findMany({
      where: { userId },
      include: {
        series: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Get all noted series with details
   */
  static async getNotedSeries(userId: string) {
    return prisma.userSeriesNote.findMany({
      where: { userId },
      include: {
        series: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }
}
