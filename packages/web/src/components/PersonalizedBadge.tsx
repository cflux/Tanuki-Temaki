interface PersonalizedBadgeProps {
  score?: number;
}

/**
 * Badge that indicates a series has been personalized based on user preferences
 */
export function PersonalizedBadge({ score }: PersonalizedBadgeProps) {
  if (score === undefined) return null;

  // Determine badge color based on score
  let colorClass = 'bg-transparent border border-cyber-accent text-cyber-accent shadow-cyber-sm';
  let icon = '[AI]';

  if (score > 10) {
    // Highly recommended
    colorClass = 'bg-transparent border border-cyber-accent-bright text-cyber-accent-bright shadow-cyber-md';
    icon = '[++]';
  } else if (score < -50) {
    // Not recommended
    colorClass = 'bg-transparent border border-red-500 text-red-400';
    icon = '[!!]';
  }

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 border text-xs font-medium uppercase tracking-wide ${colorClass}`}
      title={`Personalized Score: ${score > 0 ? '+' : ''}${score}`}
    >
      <span>{icon}</span>
      <span>PERSONALIZED</span>
    </div>
  );
}
