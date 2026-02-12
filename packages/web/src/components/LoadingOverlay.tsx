import type { LoadingProgress } from '../store/discoveryStore';

interface LoadingOverlayProps {
  progress: LoadingProgress;
}

export function LoadingOverlay({ progress }: LoadingOverlayProps) {
  const getStepIcon = (step: LoadingProgress['step']) => {
    switch (step) {
      case 'searching':
        return '🔍';
      case 'caching':
        return '💾';
      case 'tracing':
        return '🕸️';
      case 'complete':
        return '✅';
      case 'rate_limited':
        return '⏳';
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Icon and Message */}
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl animate-pulse">{getStepIcon(progress.step)}</div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1">
              {progress.step === 'searching' && 'Searching AniList'}
              {progress.step === 'caching' && 'Caching Series Data'}
              {progress.step === 'tracing' && 'Tracing Relationships'}
              {progress.step === 'complete' && 'Complete'}
              {progress.step === 'rate_limited' && 'Rate Limited'}
            </h3>
            <p className="text-zinc-400 text-sm">{progress.message}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Counter */}
        {progress.current !== undefined && progress.total !== undefined && (
          <div className="text-center text-sm text-zinc-400">
            <span className="font-mono text-blue-400">{progress.current}</span>
            {' / '}
            <span className="font-mono text-zinc-300">{progress.total}</span>
            {' series discovered'}
          </div>
        )}

        {/* Spinner for indeterminate progress */}
        {progress.current === undefined && (
          <div className="flex justify-center">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {/* Rate Limit Warning */}
        {progress.rateLimitInfo && (
          <div className="mt-6 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="font-semibold">
                  Waiting for API cooldown ({Math.ceil(progress.rateLimitInfo.waitTimeMs / 1000)}s)
                </div>
                <div className="text-xs text-zinc-500">
                  Attempt {progress.rateLimitInfo.attempt + 1} of {progress.rateLimitInfo.maxRetries + 1}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
