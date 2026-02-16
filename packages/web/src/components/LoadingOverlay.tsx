import type { LoadingProgress } from '../store/discoveryStore';

interface LoadingOverlayProps {
  progress: LoadingProgress;
}

export function LoadingOverlay({ progress }: LoadingOverlayProps) {
  const getStepIcon = (step: LoadingProgress['step']) => {
    switch (step) {
      case 'searching':
        return '[>>]';
      case 'caching':
        return '[DB]';
      case 'tracing':
        return '[//]';
      case 'complete':
        return '[OK]';
      case 'rate_limited':
        return '[..]';
    }
  };

  const calculateProgress = () => {
    if (progress.current !== undefined && progress.total !== undefined) {
      return (progress.current / progress.total) * 100;
    }
    // Default progress for steps without specific counts
    switch (progress.step) {
      case 'searching':
        return 25;
      case 'caching':
        return 50;
      case 'tracing':
        return 75;
      case 'complete':
        return 100;
    }
  };

  const progressPercent = calculateProgress();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-cyber-bg-elevated border-2 border-cyber-accent p-8 max-w-md w-full mx-4 shadow-cyber-xl">
        {/* Icon and Message */}
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl animate-cyber-pulse">{getStepIcon(progress.step)}</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-cyber-text-bright mb-1 uppercase tracking-widest">
              {progress.step === 'searching' && 'SEARCHING ANILIST'}
              {progress.step === 'caching' && 'CACHING DATA'}
              {progress.step === 'tracing' && 'TRACING NETWORK'}
              {progress.step === 'complete' && 'COMPLETE'}
              {progress.step === 'rate_limited' && 'RATE LIMITED'}
            </h3>
            <p className="text-cyber-text-dim text-sm font-mono">{progress.message}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-2 bg-cyber-bg border border-cyber-border overflow-hidden">
            <div
              className="h-full bg-cyber-accent transition-all duration-300 ease-out shadow-cyber-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Counter */}
        {progress.current !== undefined && progress.total !== undefined && (
          <div className="text-center text-sm text-cyber-text-dim uppercase tracking-wide">
            <span className="font-mono text-cyber-accent">{progress.current}</span>
            {' / '}
            <span className="font-mono text-cyber-text">{progress.total}</span>
            {' SERIES DISCOVERED'}
          </div>
        )}

        {/* Spinner for indeterminate progress */}
        {progress.current === undefined && (
          <div className="flex justify-center">
            <div className="w-6 h-6 border-2 border-cyber-border border-t-cyber-accent animate-spin" />
          </div>
        )}

        {/* Rate Limit Warning */}
        {progress.rateLimitInfo && (
          <div className="mt-6 pt-4 border-t border-cyber-border">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="font-semibold uppercase tracking-wide">
                  WAITING FOR API COOLDOWN ({Math.ceil(progress.rateLimitInfo.waitTimeMs / 1000)}S)
                </div>
                <div className="text-xs text-cyber-text-dim font-mono uppercase">
                  ATTEMPT {progress.rateLimitInfo.attempt + 1} OF {progress.rateLimitInfo.maxRetries + 1}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
