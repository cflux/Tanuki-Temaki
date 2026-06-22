import { z } from 'zod';
import { agentGet } from '../client.js';

export const seriesTools = [
  {
    name: 'search_series',
    description: 'Search for anime or manga in the Tanuki-Temaki database by title. Returns a list of matching series with tags and metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Title search query' },
        mediaType: { type: 'string', enum: ['ANIME', 'MANGA'], description: 'Filter by media type (optional)' },
        limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results to return (default 10)' },
      },
      required: ['query'],
    },
    handler: async (args: unknown) => {
      const parsed = z.object({
        query: z.string().min(1),
        mediaType: z.enum(['ANIME', 'MANGA']).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }).parse(args);

      const results = await agentGet('/series/search', {
        q: parsed.query,
        mediaType: parsed.mediaType,
        limit: parsed.limit,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    },
  },

  {
    name: 'get_series',
    description: 'Get full details for a specific series by its internal ID, including tags, metadata, and your ratings/notes/votes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Series UUID (from search_series results)' },
      },
      required: ['id'],
    },
    handler: async (args: unknown) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(args);
      const series = await agentGet(`/series/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(series, null, 2) }] };
    },
  },

  {
    name: 'get_series_relationships',
    description: 'Get the relationship graph for a series — related shows/manga with similarity scores and shared tags. Useful for finding what to watch next after a series.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Series UUID' },
        maxDepth: { type: 'number', minimum: 1, maximum: 5, description: 'How many hops to traverse (default 3, higher = slower)' },
      },
      required: ['id'],
    },
    handler: async (args: unknown) => {
      const parsed = z.object({
        id: z.string().uuid(),
        maxDepth: z.number().int().min(1).max(5).optional(),
      }).parse(args);

      const graph = await agentGet(`/series/${parsed.id}/relationships`, {
        maxDepth: parsed.maxDepth,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(graph, null, 2) }] };
    },
  },

  {
    name: 'get_series_stats',
    description: 'Get summary statistics about the Tanuki-Temaki database: total series, tags, relationships, and breakdowns by provider and media type.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: async (_args: unknown) => {
      const stats = await agentGet('/series/stats');
      return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
    },
  },
];
