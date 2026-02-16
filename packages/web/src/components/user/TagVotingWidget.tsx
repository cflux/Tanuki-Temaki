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
      <span className="px-2 py-1 bg-transparent border border-cyber-border-dim text-cyber-text-dim text-sm uppercase tracking-wide font-mono">
        {tagValue}
      </span>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 text-sm transition-colors uppercase tracking-wide font-mono ${
        vote === 1
          ? 'bg-transparent text-cyber-accent border border-cyber-accent shadow-cyber-sm'
          : vote === -1
          ? 'bg-transparent text-red-400 border border-red-500'
          : 'bg-transparent text-cyber-text-dim border border-cyber-border-dim'
      }`}
    >
      {/* Upvote button */}
      <button
        onClick={() => handleVote(1)}
        disabled={isLoading}
        className={`p-0.5 transition-colors ${
          vote === 1
            ? 'text-cyber-accent'
            : 'text-cyber-border hover:text-cyber-accent'
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
        className={`p-0.5 transition-colors ${
          vote === -1
            ? 'text-red-400'
            : 'text-cyber-border hover:text-red-400'
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
