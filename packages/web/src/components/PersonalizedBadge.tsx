interface PersonalizedBadgeProps {
  score?: number;
}

/**
 * Badge that indicates a series has been personalized based on user preferences
 */
export function PersonalizedBadge({ score }: PersonalizedBadgeProps) {
  if (score === undefined) return null;

  // Determine badge color based on score
  let colorClass = 'bg-purple-600/20 border-purple-600/50 text-purple-300';
  let emoji = '✨';

  if (score > 10) {
    // Highly recommended
    colorClass = 'bg-green-600/20 border-green-600/50 text-green-300';
    emoji = '🌟';
  } else if (score < -50) {
    // Not recommended
    colorClass = 'bg-red-600/20 border-red-600/50 text-red-300';
    emoji = '⚠️';
  }

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${colorClass}`}
      title={`Personalized Score: ${score > 0 ? '+' : ''}${score}`}
    >
      <span>{emoji}</span>
      <span>Personalized</span>
    </div>
  );
}
