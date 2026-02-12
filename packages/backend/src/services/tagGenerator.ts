import type { RawSeriesData } from '@tanuki-temaki/shared';
import compromise from 'compromise';
import { logger } from '../lib/logger.js';

export interface GeneratedTag {
  value: string;
  source: 'genre' | 'content' | 'description' | 'manual';
  confidence: number;
  category?: string;
}

/**
 * Tag generation service using rule-based NLP
 */
export class TagGenerator {
  /**
   * Generate tags from series data
   */
  generateTags(series: RawSeriesData): GeneratedTag[] {
    logger.info('Generating tags for series', { title: series.title });

    const tags: GeneratedTag[] = [];

    // 1. Direct genre mapping (highest confidence)
    tags.push(...this.mapGenres(series.genres));

    // 2. Content advisory mapping
    tags.push(...this.mapContentAdvisory(series.contentAdvisory));

    // 3. Description keyword extraction
    tags.push(...this.extractKeywords(series.description));

    // 4. Pattern matching for common themes
    tags.push(...this.matchPatterns(series.description, series.title));

    // Deduplicate and score
    const finalTags = this.deduplicateAndScore(tags);

    logger.info('Generated tags', {
      title: series.title,
      count: finalTags.length,
      tags: finalTags.map(t => t.value),
    });

    return finalTags;
  }

  /**
   * Map genres to tags (1:1 mapping with highest confidence)
   */
  private mapGenres(genres: string[]): GeneratedTag[] {
    return genres.map(genre => ({
      value: this.normalizeTagValue(genre),
      source: 'genre' as const,
      confidence: 1.0,
      category: 'genre',
    }));
  }

  /**
   * Map content advisories to theme tags
   */
  private mapContentAdvisory(advisories: string[]): GeneratedTag[] {
    const mapping: Record<string, string[]> = {
      violence: ['action', 'intense', 'mature'],
      language: ['mature'],
      'sexual content': ['mature', 'romance'],
      'sexual themes': ['mature', 'romance'],
      fear: ['horror', 'thriller', 'dark'],
      'frightening scenes': ['horror', 'thriller', 'dark'],
      nudity: ['mature'],
      'suggestive themes': ['ecchi', 'romance'],
      gore: ['horror', 'dark', 'violent'],
      'drug use': ['mature', 'dark'],
      alcohol: ['mature'],
    };

    const tags: GeneratedTag[] = [];

    for (const advisory of advisories) {
      const key = advisory.toLowerCase();
      const mappedTags = mapping[key] || [];

      for (const tag of mappedTags) {
        tags.push({
          value: tag,
          source: 'content',
          confidence: 0.8,
          category: 'theme',
        });
      }
    }

    return tags;
  }

  /**
   * Extract keywords from description using NLP
   */
  private extractKeywords(description: string): GeneratedTag[] {
    if (!description || description.length < 10) {
      return [];
    }

    const doc = compromise(description);

    // Extract nouns and proper nouns
    const nouns = doc.nouns().out('array') as string[];
    const topics = doc.topics().out('array') as string[];

    // Combine and filter
    const keywords = [...new Set([...nouns, ...topics])]
      .map(w => w.toLowerCase())
      .filter(w => {
        // Filter out common words and short words
        return (
          w.length > 3 &&
          !this.isStopWord(w) &&
          !this.isCommonWord(w)
        );
      })
      .slice(0, 10); // Limit to top 10

    return keywords.map(keyword => ({
      value: this.normalizeTagValue(keyword),
      source: 'description' as const,
      confidence: 0.6,
      category: 'theme',
    }));
  }

  /**
   * Match regex patterns for common anime themes
   */
  private matchPatterns(description: string, title: string): GeneratedTag[] {
    const text = `${title} ${description}`.toLowerCase();
    const tags: GeneratedTag[] = [];

    const patterns = [
      // Settings
      { pattern: /high school|school life|academy/i, tags: ['school', 'slice-of-life'] },
      { pattern: /medieval|kingdom|castle|knight/i, tags: ['medieval', 'fantasy'] },
      { pattern: /space|galaxy|planet|spaceship/i, tags: ['space', 'sci-fi'] },
      { pattern: /post-apocalyptic|apocalypse|wasteland/i, tags: ['post-apocalyptic', 'dystopian'] },

      // Genres/Themes
      { pattern: /magical girl|mahou shoujo/i, tags: ['magical-girl', 'fantasy'] },
      { pattern: /isekai|another world|transported|reincarnated/i, tags: ['isekai', 'fantasy'] },
      { pattern: /mecha|robot|gundam|pilot/i, tags: ['mecha', 'sci-fi'] },
      { pattern: /romance|love|relationship/i, tags: ['romance'] },
      { pattern: /comedy|funny|hilarious|humor/i, tags: ['comedy'] },
      { pattern: /mystery|detective|investigation/i, tags: ['mystery'] },
      { pattern: /supernatural|ghost|spirit|demon/i, tags: ['supernatural'] },
      { pattern: /slice of life|everyday|daily life/i, tags: ['slice-of-life'] },
      { pattern: /sports|tournament|competition|team/i, tags: ['sports'] },
      { pattern: /psychological|mind|mental/i, tags: ['psychological'] },
      { pattern: /martial arts|kung fu|fighting|combat/i, tags: ['martial-arts', 'action'] },

      // Character types
      { pattern: /ninja|shinobi/i, tags: ['ninja', 'action'] },
      { pattern: /samurai|ronin|sword/i, tags: ['samurai', 'historical'] },
      { pattern: /vampire|blood/i, tags: ['vampire', 'supernatural'] },
      { pattern: /zombie|undead/i, tags: ['zombie', 'horror'] },
      { pattern: /spy|espionage|agent/i, tags: ['spy', 'thriller'] },

      // Moods
      { pattern: /dark|grim|brutal/i, tags: ['dark'] },
      { pattern: /wholesome|heartwarming|feel-good/i, tags: ['wholesome'] },
      { pattern: /epic|grand|legendary/i, tags: ['epic'] },
    ];

    for (const { pattern, tags: patternTags } of patterns) {
      if (pattern.test(text)) {
        for (const tag of patternTags) {
          tags.push({
            value: tag,
            source: 'description',
            confidence: 0.9,
            category: 'theme',
          });
        }
      }
    }

    return tags;
  }

  /**
   * Deduplicate tags and keep highest confidence
   */
  private deduplicateAndScore(tags: GeneratedTag[]): GeneratedTag[] {
    const tagMap = new Map<string, GeneratedTag>();

    for (const tag of tags) {
      const existing = tagMap.get(tag.value);
      if (existing) {
        // Keep tag with highest confidence
        if (tag.confidence > existing.confidence) {
          tagMap.set(tag.value, tag);
        }
      } else {
        tagMap.set(tag.value, tag);
      }
    }

    // Sort by confidence (highest first)
    return Array.from(tagMap.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Normalize tag value (lowercase, hyphenated)
   */
  private normalizeTagValue(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    ]);
    return stopWords.has(word);
  }

  /**
   * Check if word is too common in anime descriptions
   */
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'anime', 'series', 'story', 'world', 'life', 'time', 'year', 'day',
      'episode', 'character', 'season', 'show', 'follows', 'tells', 'watch',
    ]);
    return commonWords.has(word);
  }
}
