import React, { useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { userApi } from '../../lib/api';
import { useSyncedState } from '../../hooks';

interface TagVotingWidgetProps {
  seriesId: string;
  tagValue: string;
  initialVote?: number | null;
  onVoteChange?: (vote: number | null) => void;
}

export const TagVotingWidget: React.FC<TagVotingWidgetProps> = ({
  seriesId,
  tagValue,
  initialVote,
  onVoteChange,
}) => {
  const user = useUserStore((state) => state.user);
  const [vote, setVote] = useSyncedState(initialVote);
  const [isLoading, setIsLoading] = useState(false);

  const handleVote = async (newVote: 1 | -1) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // If clicking the same vote, remove it
      if (vote === newVote) {
        await userApi.removeTagVote(seriesId, tagValue);
        setVote(null);
        onVoteChange?.(null);
      } else {
        await userApi.voteOnTag(seriesId, tagValue, newVote);
        setVote(newVote);
        onVoteChange?.(newVote);
      }
    } catch (error) {
      console.error('Failed to update tag vote:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <span className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded-md text-sm">
        {tagValue}
      </span>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors ${
        vote === 1
          ? 'bg-green-900/30 text-green-400 border border-green-700/50'
          : vote === -1
          ? 'bg-red-900/30 text-red-400 border border-red-700/50'
          : 'bg-zinc-800 text-zinc-300 border border-transparent'
      }`}
    >
      {/* Upvote button */}
      <button
        onClick={() => handleVote(1)}
        disabled={isLoading}
        className={`p-0.5 rounded transition-colors ${
          vote === 1
            ? 'text-green-400'
            : 'text-zinc-500 hover:text-green-400'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Upvote this tag"
      >
        <svg className="w-4 h-4" fill={vote === 1 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
          />
        </svg>
      </button>

      {/* Tag value */}
      <span className="px-1">{tagValue}</span>

      {/* Downvote button */}
      <button
        onClick={() => handleVote(-1)}
        disabled={isLoading}
        className={`p-0.5 rounded transition-colors ${
          vote === -1
            ? 'text-red-400'
            : 'text-zinc-500 hover:text-red-400'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Downvote this tag"
      >
        <svg className="w-4 h-4" fill={vote === -1 ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
          />
        </svg>
      </button>
    </div>
  );
};
