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
    <div className="mt-2 p-3 bg-cyber-bg-elevated border border-cyber-accent shadow-cyber-sm">
      <div className="flex items-start gap-2">
        <div className="text-cyber-accent mt-0.5 font-bold">[?]</div>
        <div className="flex-1">
          <div className="text-sm font-medium text-cyber-accent mb-1 uppercase tracking-wider">
            WHY THIS WAS RECOMMENDED
          </div>
          {reason && (
            <div className="text-sm text-cyber-text mb-2 font-mono">{reason}</div>
          )}
          {matchedTags && matchedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {matchedTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-transparent border border-cyber-accent text-cyber-accent text-xs uppercase tracking-wide font-mono"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {score !== undefined && score !== 0 && (
            <div className="text-xs text-cyber-text-dim mt-2 uppercase tracking-wide font-mono">
              PERSONALIZATION SCORE: {score > 0 ? '+' : ''}{score}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
