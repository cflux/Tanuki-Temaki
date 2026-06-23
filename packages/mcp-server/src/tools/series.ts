import { z } from 'zod';
import { agentGet } from '../client.js';
import type { ToolDef } from './types.js';

export const seriesTools: ToolDef[] = [
  {
    name: 'search_series',
    description: 'Search for anime or manga in the Tanuki-Temaki database by title. Returns a list of matching series with tags and metadata.',
    schema: {
      query: z.string().min(1).describe('Title search query'),
      mediaType: z.enum(['ANIME', 'MANGA']).optional().describe('Filter by media type (optional)'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results to return (default 10)'),
    },
    handler: async (args) => {
      const results = await agentGet('/series/search', {
        q: args.query,
        mediaType: args.mediaType,
        limit: args.limit,
      });
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  },

  {
    name: 'get_series',
    description: 'Get full details for a specific series by its internal ID, including tags, metadata, and your ratings/notes/votes.',
    schema: {
      id: z.string().uuid().describe('Series UUID (from search_series results)'),
    },
    handler: async (args) => {
      const series = await agentGet(`/series/${args.id}`);
      return { content: [{ type: 'text', text: JSON.stringify(series, null, 2) }] };
    },
  },

  {
    name: 'get_series_relationships',
    description: 'Get the relationship graph for a series — related shows/manga with similarity scores and shared tags. Useful for finding what to watch next after a series.',
    schema: {
      id: z.string().uuid().describe('Series UUID'),
      maxDepth: z.number().int().min(1).max(5).optional().describe('How many hops to traverse (default 3, higher = slower)'),
    },
    handler: async (args) => {
      const graph = await agentGet(`/series/${args.id}/relationships`, {
        maxDepth: args.maxDepth,
      });
      return { content: [{ type: 'text', text: JSON.stringify(graph, null, 2) }] };
    },
  },

  {
    name: 'get_series_stats',
    description: 'Get summary statistics about the Tanuki-Temaki database: total series, tags, relationships, and breakdowns by provider and media type.',
    handler: async () => {
      const stats = await agentGet('/series/stats');
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    },
  },
];
