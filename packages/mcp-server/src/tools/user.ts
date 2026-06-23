import { z } from 'zod';
import { agentGet } from '../client.js';

export const userTools = [
  {
    name: 'get_my_profile',
    description: 'Get the profile of the user this API key belongs to.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: async (_args: unknown) => {
      const profile = await agentGet('/user/profile');
      return { content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }] };
    },
  },

  {
    name: 'get_my_ratings',
    description: 'Get all series rated by the user. Ratings are 0-5 (0 = disliked, 5 = loved). Optionally filter by minimum rating or media type.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        minRating: { type: 'number', minimum: 0, maximum: 5, description: 'Only return ratings at or above this value' },
        mediaType: { type: 'string', enum: ['ANIME', 'MANGA'], description: 'Filter by media type' },
      },
      required: [],
    },
    handler: async (args: unknown) => {
      const parsed = z.object({
        minRating: z.number().int().min(0).max(5).optional(),
        mediaType: z.enum(['ANIME', 'MANGA']).optional(),
      }).parse(args);

      const ratings = await agentGet('/user/ratings', {
        minRating: parsed.minRating,
        mediaType: parsed.mediaType,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(ratings, null, 2) }] };
    },
  },

  {
    name: 'get_my_watchlist',
    description: 'Get the user\'s watchlist. Optionally filter by status: plan_to_watch, watching, completed, on_hold, or dropped.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped'],
          description: 'Filter by watchlist status',
        },
      },
      required: [],
    },
    handler: async (args: unknown) => {
      const parsed = z.object({
        status: z.enum(['plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped']).optional(),
      }).parse(args);

      const watchlist = await agentGet('/user/watchlist', { status: parsed.status });
      return { content: [{ type: 'text' as const, text: JSON.stringify(watchlist, null, 2) }] };
    },
  },

  {
    name: 'get_my_notes',
    description: 'Get all series the user has written private notes on, including the note text and full series details.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: async (_args: unknown) => {
      const notes = await agentGet('/user/notes');
      return { content: [{ type: 'text' as const, text: JSON.stringify(notes, null, 2) }] };
    },
  },

  {
    name: 'get_my_tag_preferences',
    description: 'Get the user\'s aggregated tag vote scores. Returns { tagValue: score } where positive scores indicate liked tags and negative scores indicate disliked tags.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: async (_args: unknown) => {
      const prefs = await agentGet('/user/tag-preferences');
      return { content: [{ type: 'text' as const, text: JSON.stringify(prefs, null, 2) }] };
    },
  },

  {
    name: 'get_my_preferences',
    description: 'Get the user\'s app preferences: theme, media_filter, adult_filter, prefer_personalized, and available_services.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handler: async (_args: unknown) => {
      const prefs = await agentGet('/user/preferences');
      return { content: [{ type: 'text' as const, text: JSON.stringify(prefs, null, 2) }] };
    },
  },
];
