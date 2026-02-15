interface RecommendationExplanationProps {
  reason?: string;
  matchedTags?: string[];
  score?: number;
}

/**
 * Displays why a series was recommended based on personalization
 */
export function RecommendationExplanation({
  reason,
  matchedTags,
  score,
}: RecommendationExplanationProps) {
  if (!reason && (!matchedTags || matchedTags.length === 0)) return null;

  return (
    <div className="mt-2 p-3 bg-purple-900/20 border border-purple-600/30 rounded-lg">
      <div className="flex items-start gap-2">
        <div className="text-purple-400 mt-0.5">💡</div>
        <div className="flex-1">
          <div className="text-sm font-medium text-purple-300 mb-1">
            Why this was recommended
          </div>
          {reason && (
            <div className="text-sm text-zinc-300 mb-2">{reason}</div>
          )}
          {matchedTags && matchedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {matchedTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-purple-600/30 border border-purple-600/50 text-purple-200 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {score !== undefined && score !== 0 && (
            <div className="text-xs text-zinc-400 mt-2">
              Personalization score: {score > 0 ? '+' : ''}{score}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
