import { z } from 'zod';
import { agentGet } from '../client.js';
import type { ToolDef } from './types.js';

export const userTools: ToolDef[] = [
  {
    name: 'get_my_profile',
    description: 'Get the profile of the user this API key belongs to.',
    handler: async () => {
      const profile = await agentGet('/user/profile');
      return { content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }] };
    },
  },

  {
    name: 'get_my_ratings',
    description: 'Get all series rated by the user. Ratings are 0-5 (0 = disliked, 5 = loved). Optionally filter by minimum rating or media type.',
    schema: {
      minRating: z.number().int().min(0).max(5).optional().describe('Only return ratings at or above this value'),
      mediaType: z.enum(['ANIME', 'MANGA']).optional().describe('Filter by media type'),
    },
    handler: async (args) => {
      const ratings = await agentGet('/user/ratings', {
        minRating: args.minRating,
        mediaType: args.mediaType,
      });
      return { content: [{ type: 'text', text: JSON.stringify(ratings, null, 2) }] };
    },
  },

  {
    name: 'get_my_watchlist',
    description: "Get the user's watchlist. Optionally filter by status: plan_to_watch, watching, completed, on_hold, or dropped.",
    schema: {
      status: z
        .enum(['plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped'])
        .optional()
        .describe('Filter by watchlist status'),
    },
    handler: async (args) => {
      const watchlist = await agentGet('/user/watchlist', { status: args.status });
      return { content: [{ type: 'text', text: JSON.stringify(watchlist, null, 2) }] };
    },
  },

  {
    name: 'get_my_notes',
    description: 'Get all series the user has written private notes on, including the note text and full series details.',
    handler: async () => {
      const notes = await agentGet('/user/notes');
      return { content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }] };
    },
  },

  {
    name: 'get_my_tag_preferences',
    description: "Get the user's aggregated tag vote scores. Returns { tagValue: score } where positive scores indicate liked tags and negative scores indicate disliked tags.",
    handler: async () => {
      const prefs = await agentGet('/user/tag-preferences');
      return { content: [{ type: 'text', text: JSON.stringify(prefs, null, 2) }] };
    },
  },

  {
    name: 'get_my_preferences',
    description: "Get the user's app preferences: theme, media_filter, adult_filter, prefer_personalized, and available_services.",
    handler: async () => {
      const prefs = await agentGet('/user/preferences');
      return { content: [{ type: 'text', text: JSON.stringify(prefs, null, 2) }] };
    },
  },
];
