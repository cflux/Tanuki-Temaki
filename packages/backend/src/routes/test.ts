import express from 'express';
import { AniListAdapter } from '../adapters/anilist.js';
import { logger } from '../lib/logger.js';
import { ANILIST_API_URL, JSON_HEADERS } from '../config/constants.js';

const router = express.Router();
const anilistAdapter = new AniListAdapter();

/**
 * GET /api/test/health
 * Simple health check to verify route is working
 */
router.get('/health', (req, res) => {
  logger.info('Test health endpoint hit');
  res.json({ status: 'ok', message: 'Test router is working' });
});

/**
 * POST /api/test/isadult
 * Test endpoint to compare isAdult parameter behavior
 */
router.post('/isadult', async (req, res) => {
  logger.info('Test endpoint hit', { body: req.body });
  try {
    const { queryType, isAdultValue, searchInput, tagInput, anilistId } = req.body;

    // Basic validation
    const validQueryTypes = ['searchMedia', 'searchMediaMultiple', 'getAnimeWithRelations', 'searchByTag'];
    const validIsAdultValues = ['omit', 'true', 'false'];

    if (!validQueryTypes.includes(queryType)) {
      return res.status(400).json({ error: 'Invalid queryType' });
    }

    if (!validIsAdultValues.includes(isAdultValue)) {
      return res.status(400).json({ error: 'Invalid isAdultValue' });
    }

    logger.info('Running isAdult test', { queryType, isAdultValue, searchInput, tagInput, anilistId });

    // Determine the actual isAdult value to pass to the query
    const isAdultParam = isAdultValue === 'omit' ? undefined : isAdultValue === 'true';

    let results: any[] = [];
    let resultCount = 0;

    switch (queryType) {
      case 'searchMedia': {
        if (!searchInput) {
          return res.status(400).json({ error: 'searchInput required for searchMedia' });
        }
        const result = await testSearchMedia(searchInput, isAdultParam);
        results = result ? [result] : [];
        resultCount = results.length;
        break;
      }

      case 'searchMediaMultiple': {
        if (!searchInput) {
          return res.status(400).json({ error: 'searchInput required for searchMediaMultiple' });
        }
        results = await testSearchMediaMultiple(searchInput, isAdultParam);
        resultCount = results.length;
        break;
      }

      case 'getAnimeWithRelations': {
        if (!anilistId) {
          return res.status(400).json({ error: 'anilistId required for getAnimeWithRelations' });
        }
        const result = await testGetAnimeWithRelations(parseInt(anilistId), isAdultParam);
        if (result) {
          // Count main media + relations + recommendations
          const relationsCount = result.relations?.edges?.length || 0;
          const recommendationsCount = result.recommendations?.edges?.length || 0;
          resultCount = 1 + relationsCount + recommendationsCount;

          // Flatten for display
          results = [
            { ...result, _type: 'main' },
            ...(result.relations?.edges?.map((e: any) => ({ ...e.node, _type: 'relation', relationType: e.relationType })) || []),
            ...(result.recommendations?.edges?.map((e: any) => ({ ...e.node.mediaRecommendation, _type: 'recommendation', rating: e.node.rating })) || []),
          ];
        }
        break;
      }

      case 'searchByTag': {
        if (!tagInput) {
          return res.status(400).json({ error: 'tagInput required for searchByTag' });
        }
        results = await testSearchByTag(tagInput, isAdultParam);
        resultCount = results.length;
        break;
      }

      default:
        return res.status(400).json({ error: 'Invalid queryType' });
    }

    res.json({
      queryType,
      isAdultValue,
      resultCount,
      results: results.slice(0, 20), // Limit to 20 for display
    });
  } catch (error) {
    logger.error('isAdult test error', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * Test searchMedia with optional isAdult parameter
 */
async function testSearchMedia(title: string, isAdult?: boolean): Promise<any | null> {
  const query = `
    query ($search: String, $type: MediaType, $isAdult: Boolean) {
      Media(search: $search, type: $type, isAdult: $isAdult) {
        id
        type
        title {
          romaji
          english
        }
        isAdult
        averageScore
        popularity
      }
    }
  `;

  const variables: any = { search: title, type: 'ANIME' };
  if (isAdult !== undefined) {
    variables.isAdult = isAdult;
  }

  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  return json.data?.Media || null;
}

/**
 * Test searchMediaMultiple with optional isAdult parameter
 */
async function testSearchMediaMultiple(title: string, isAdult?: boolean): Promise<any[]> {
  const query = `
    query ($search: String, $type: MediaType, $isAdult: Boolean, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(search: $search, type: $type, isAdult: $isAdult, sort: SEARCH_MATCH) {
          id
          type
          title {
            romaji
            english
          }
          isAdult
          averageScore
          popularity
        }
      }
    }
  `;

  const variables: any = { search: title, type: 'ANIME', perPage: 10 };
  if (isAdult !== undefined) {
    variables.isAdult = isAdult;
  }

  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  return json.data?.Page?.media || [];
}

/**
 * Test getAnimeWithRelations with optional isAdult parameter
 */
async function testGetAnimeWithRelations(id: number, isAdult?: boolean): Promise<any | null> {
  const query = `
    query ($id: Int, $type: MediaType, $isAdult: Boolean) {
      Media(id: $id, type: $type, isAdult: $isAdult) {
        id
        type
        title {
          romaji
          english
        }
        isAdult
        averageScore
        popularity
        relations {
          edges {
            relationType
            node {
              id
              type
              title {
                romaji
                english
              }
              isAdult
            }
          }
        }
        recommendations(sort: RATING_DESC, perPage: 20) {
          edges {
            node {
              rating
              mediaRecommendation {
                id
                type
                title {
                  romaji
                  english
                }
                isAdult
              }
            }
          }
        }
      }
    }
  `;

  const variables: any = { id, type: 'ANIME' };
  if (isAdult !== undefined) {
    variables.isAdult = isAdult;
  }

  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  return json.data?.Media || null;
}

/**
 * Test searchByTag with optional isAdult parameter
 */
async function testSearchByTag(tag: string, isAdult?: boolean): Promise<any[]> {
  const query = `
    query ($tag_in: [String], $isAdult: Boolean, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(tag_in: $tag_in, isAdult: $isAdult, sort: [POPULARITY_DESC, SCORE_DESC]) {
          id
          type
          title {
            romaji
            english
          }
          isAdult
          averageScore
          popularity
        }
      }
    }
  `;

  const variables: any = { tag_in: [tag], perPage: 20 };
  if (isAdult !== undefined) {
    variables.isAdult = isAdult;
  }

  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();
  return json.data?.Page?.media || [];
}

export default router;
