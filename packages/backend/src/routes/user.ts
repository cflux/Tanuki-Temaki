import express from 'express';
import { requireAuth } from '../middleware/auth';
import { UserService } from '../services/user';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// ==================== RATINGS ====================

/**
 * Rate a series
 */
router.post('/ratings', async (req, res) => {
  try {
    const { seriesId, rating } = req.body;

    if (!seriesId || rating === undefined) {
      return res.status(400).json({ error: 'seriesId and rating are required' });
    }

    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return res.status(400).json({ error: 'rating must be a number between 0 and 5' });
    }

    const result = await UserService.rateSeries(req.user!.userId, seriesId, rating);
    res.json(result);
  } catch (error) {
    console.error('Error rating series:', error);
    res.status(500).json({ error: 'Failed to rate series' });
  }
});

/**
 * Get user's rating for a series
 */
router.get('/ratings/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const rating = await UserService.getUserRating(req.user!.userId, seriesId);
    res.json(rating);
  } catch (error) {
    console.error('Error fetching rating:', error);
    res.status(500).json({ error: 'Failed to fetch rating' });
  }
});

/**
 * Get all user's ratings
 */
router.get('/ratings', async (req, res) => {
  try {
    const ratings = await UserService.getAllRatings(req.user!.userId);
    res.json(ratings);
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

/**
 * Delete a rating
 */
router.delete('/ratings/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    await UserService.deleteRating(req.user!.userId, seriesId);
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Rating not found' });
    }
    console.error('Error deleting rating:', error);
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

// ==================== NOTES ====================

/**
 * Save a note for a series
 */
router.post('/notes', async (req, res) => {
  try {
    const { seriesId, note } = req.body;

    if (!seriesId || !note) {
      return res.status(400).json({ error: 'seriesId and note are required' });
    }

    const result = await UserService.saveNote(req.user!.userId, seriesId, note);
    res.json(result);
  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

/**
 * Get user's note for a series
 */
router.get('/notes/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const note = await UserService.getNote(req.user!.userId, seriesId);
    res.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

/**
 * Delete a note
 */
router.delete('/notes/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    await UserService.deleteNote(req.user!.userId, seriesId);
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Note not found' });
    }
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// ==================== TAG VOTING ====================

/**
 * Vote on a tag
 */
router.post('/tag-votes', async (req, res) => {
  try {
    const { seriesId, tagValue, vote } = req.body;

    if (!seriesId || !tagValue || vote === undefined) {
      return res.status(400).json({ error: 'seriesId, tagValue, and vote are required' });
    }

    if (vote !== 1 && vote !== -1) {
      return res.status(400).json({ error: 'vote must be 1 (upvote) or -1 (downvote)' });
    }

    const result = await UserService.voteOnTag(req.user!.userId, seriesId, tagValue, vote);
    res.json(result);
  } catch (error) {
    console.error('Error voting on tag:', error);
    res.status(500).json({ error: 'Failed to vote on tag' });
  }
});

/**
 * Remove tag vote
 */
router.delete('/tag-votes/:seriesId/:tagValue', async (req, res) => {
  try {
    const { seriesId, tagValue } = req.params;
    await UserService.removeTagVote(req.user!.userId, seriesId, tagValue);
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Tag vote not found' });
    }
    console.error('Error removing tag vote:', error);
    res.status(500).json({ error: 'Failed to remove tag vote' });
  }
});

/**
 * Get tag votes for a series
 */
router.get('/tag-votes/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const votes = await UserService.getSeriesTagVotes(req.user!.userId, seriesId);
    res.json(votes);
  } catch (error) {
    console.error('Error fetching tag votes:', error);
    res.status(500).json({ error: 'Failed to fetch tag votes' });
  }
});

/**
 * Get user's tag preferences (aggregated)
 */
router.get('/tag-preferences', async (req, res) => {
  try {
    const preferences = await UserService.getUserTagPreferences(req.user!.userId);
    // Convert Map to object for JSON response
    const preferencesObj = Object.fromEntries(preferences);
    res.json(preferencesObj);
  } catch (error) {
    console.error('Error fetching tag preferences:', error);
    res.status(500).json({ error: 'Failed to fetch tag preferences' });
  }
});

// ==================== PREFERENCES ====================

/**
 * Set a preference
 */
router.post('/preferences', async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }

    const result = await UserService.setPreference(req.user!.userId, key, value);
    res.json(result);
  } catch (error) {
    console.error('Error setting preference:', error);
    res.status(500).json({ error: 'Failed to set preference' });
  }
});

/**
 * Get all preferences
 */
router.get('/preferences', async (req, res) => {
  try {
    const preferences = await UserService.getAllPreferences(req.user!.userId);
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * Set available services (convenience endpoint)
 */
router.post('/preferences/available-services', async (req, res) => {
  try {
    const { services } = req.body;

    if (!Array.isArray(services)) {
      return res.status(400).json({ error: 'services must be an array' });
    }

    const result = await UserService.setAvailableServices(req.user!.userId, services);
    res.json(result);
  } catch (error) {
    console.error('Error setting available services:', error);
    res.status(500).json({ error: 'Failed to set available services' });
  }
});

/**
 * Get available services (convenience endpoint)
 */
router.get('/preferences/available-services', async (req, res) => {
  try {
    const services = await UserService.getAvailableServices(req.user!.userId);
    res.json(services);
  } catch (error) {
    console.error('Error fetching available services:', error);
    res.status(500).json({ error: 'Failed to fetch available services' });
  }
});

// ==================== WATCHLIST ====================

/**
 * Add series to watchlist
 */
router.post('/watchlist', async (req, res) => {
  try {
    const { seriesId, status } = req.body;

    if (!seriesId) {
      return res.status(400).json({ error: 'seriesId is required' });
    }

    const result = await UserService.addToWatchlist(req.user!.userId, seriesId, status);
    res.json(result);
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

/**
 * Remove series from watchlist
 */
router.delete('/watchlist/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;

    await UserService.removeFromWatchlist(req.user!.userId, seriesId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

/**
 * Get user's watchlist
 */
router.get('/watchlist', async (req, res) => {
  try {
    const watchlist = await UserService.getWatchlist(req.user!.userId);
    res.json(watchlist);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

/**
 * Get watchlist status for multiple series (batch)
 */
router.post('/watchlist/batch', async (req, res) => {
  try {
    const { seriesIds } = req.body;

    if (!Array.isArray(seriesIds) || seriesIds.length === 0) {
      return res.status(400).json({ error: 'seriesIds must be a non-empty array' });
    }

    // Limit batch size to prevent abuse
    if (seriesIds.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 series IDs per batch' });
    }

    const statuses = await Promise.all(
      seriesIds.map(async (seriesId) => {
        const status = await UserService.getWatchlistStatus(req.user!.userId, seriesId);
        return {
          seriesId,
          status: status?.status || null,
        };
      })
    );

    res.json(statuses);
  } catch (error) {
    console.error('Error fetching batch watchlist status:', error);
    res.status(500).json({ error: 'Failed to fetch batch watchlist status' });
  }
});

/**
 * Get watchlist status for a specific series
 */
router.get('/watchlist/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const status = await UserService.getWatchlistStatus(req.user!.userId, seriesId);
    res.json(status);
  } catch (error) {
    console.error('Error fetching watchlist status:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist status' });
  }
});

/**
 * Get all rated series with details
 */
router.get('/rated', async (req, res) => {
  try {
    const rated = await UserService.getRatedSeries(req.user!.userId);
    res.json(rated);
  } catch (error) {
    console.error('Error fetching rated series:', error);
    res.status(500).json({ error: 'Failed to fetch rated series' });
  }
});

/**
 * Get all noted series with details
 */
router.get('/noted', async (req, res) => {
  try {
    const noted = await UserService.getNotedSeries(req.user!.userId);
    res.json(noted);
  } catch (error) {
    console.error('Error fetching noted series:', error);
    res.status(500).json({ error: 'Failed to fetch noted series' });
  }
});

export default router;
