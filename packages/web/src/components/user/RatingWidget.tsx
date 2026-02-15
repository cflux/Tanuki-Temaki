import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import { userApi } from '../../lib/api';

interface RatingWidgetProps {
  seriesId: string;
  initialRating?: number | null;
  onRatingChange?: (rating: number | null) => void;
}

export const RatingWidget: React.FC<RatingWidgetProps> = ({
  seriesId,
  initialRating,
  onRatingChange,
}) => {
  const user = useUserStore((state) => state.user);
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state with prop changes (when data refetches)
  useEffect(() => {
    setRating(initialRating ?? null);
  }, [initialRating]);

  const handleRatingClick = async (newRating: number) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // If clicking the same rating, remove it
      if (rating === newRating) {
        await userApi.deleteRating(seriesId);
        setRating(null);
        onRatingChange?.(null);
      } else {
        await userApi.rateSeries(seriesId, newRating);
        setRating(newRating);
        onRatingChange?.(newRating);
      }
    } catch (error) {
      console.error('Failed to update rating:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <span>Sign in to rate</span>
      </div>
    );
  }

  const displayRating = hoveredRating ?? rating;

  return (
    <div className="flex items-center gap-1">
      {/* Thumbs down for rating 0 (didn't like) */}
      <button
        onClick={() => handleRatingClick(0)}
        onMouseEnter={() => setHoveredRating(0)}
        onMouseLeave={() => setHoveredRating(null)}
        disabled={isLoading}
        className={`p-1 rounded transition-colors ${
          displayRating === 0
            ? 'text-red-500'
            : 'text-zinc-500 hover:text-red-400'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Didn't like"
      >
        <svg
          className="w-5 h-5"
          fill={displayRating === 0 ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
          />
        </svg>
      </button>

      {/* Divider */}
      <div className="h-5 w-px bg-zinc-700 mx-1"></div>

      {/* Star ratings 1-5 */}
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => handleRatingClick(star)}
          onMouseEnter={() => setHoveredRating(star)}
          onMouseLeave={() => setHoveredRating(null)}
          disabled={isLoading}
          className={`transition-colors ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <svg
            className={`w-5 h-5 ${
              displayRating && displayRating >= star
                ? 'text-yellow-500 fill-current'
                : 'text-zinc-600 hover:text-yellow-400'
            }`}
            fill={displayRating && displayRating >= star ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      ))}

      {/* Show current rating text */}
      {rating !== null && (
        <span className="ml-2 text-sm text-zinc-400">
          {rating === 0 ? 'Disliked' : `${rating}/5`}
        </span>
      )}
    </div>
  );
};
