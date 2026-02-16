import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { adminApi } from '../lib/api';

interface CacheStats {
  totalSeries: number;
  totalTags: number;
  totalRelationships: number;
  byProvider: Array<{ provider: string; count: number }>;
  byMediaType: Array<{ mediaType: string; count: number }>;
}

export function MaintenancePage() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch cache stats on mount
  useEffect(() => {
    const fetchCacheStats = async () => {
      try {
        const stats = await adminApi.getCacheStats();
        setCacheStats(stats);
      } catch (error) {
        console.error('Failed to fetch cache stats:', error);
      }
    };

    if (user?.isAdmin) {
      fetchCacheStats();
    }
  }, [user]);

  const handleClearDatabase = async () => {
    if (!confirm('Are you sure you want to clear the entire cache? This will remove all series, tags, and relationship data.')) {
      return;
    }

    setIsClearing(true);
    try {
      await adminApi.clearCache();
      setClearSuccess(true);
      setCacheStats(null);

      // Refresh stats after clearing
      setTimeout(async () => {
        const stats = await adminApi.getCacheStats();
        setCacheStats(stats);
        setClearSuccess(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to clear database:', error);
      alert('Failed to clear database. Check console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  if (!user?.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-cyber-text-bright uppercase tracking-widest mb-2">
            [ADMIN] MAINTENANCE
          </h1>
          <p className="text-cyber-text-dim font-mono">
            SYSTEM MAINTENANCE AND DATABASE OPERATIONS
          </p>
        </div>

        {/* Cache Statistics */}
        {cacheStats && (
          <div className="mb-6 bg-cyber-bg-card border border-cyber-border p-6">
            <h2 className="text-xl font-semibold text-cyber-text-bright uppercase tracking-wider mb-4 border-b border-cyber-border pb-2">
              DATABASE CACHE STATISTICS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-cyber-bg-elevated p-4 border border-cyber-border">
                <div className="text-2xl font-bold text-cyber-accent">{cacheStats.totalSeries.toLocaleString()}</div>
                <div className="text-sm text-cyber-text-dim uppercase tracking-wide">SERIES CACHED</div>
              </div>
              <div className="bg-cyber-bg-elevated p-4 border border-cyber-border">
                <div className="text-2xl font-bold text-cyber-accent">{cacheStats.totalTags.toLocaleString()}</div>
                <div className="text-sm text-cyber-text-dim uppercase tracking-wide">TAGS CACHED</div>
              </div>
              <div className="bg-cyber-bg-elevated p-4 border border-cyber-border">
                <div className="text-2xl font-bold text-cyber-accent">{cacheStats.totalRelationships.toLocaleString()}</div>
                <div className="text-sm text-cyber-text-dim uppercase tracking-wide">RELATIONSHIPS CACHED</div>
              </div>
            </div>

            {/* By Provider */}
            {cacheStats.byProvider && cacheStats.byProvider.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-cyber-text-dim uppercase tracking-wide mb-2">
                  BY PROVIDER
                </h3>
                <div className="space-y-1">
                  {cacheStats.byProvider.map((item) => (
                    <div key={item.provider} className="flex justify-between text-sm font-mono">
                      <span className="text-cyber-text">{item.provider}:</span>
                      <span className="text-cyber-accent">{item?.count?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Media Type */}
            {cacheStats.byMediaType && cacheStats.byMediaType.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-cyber-text-dim uppercase tracking-wide mb-2">
                  BY MEDIA TYPE
                </h3>
                <div className="space-y-1">
                  {cacheStats.byMediaType.map((item) => (
                    <div key={item.mediaType} className="flex justify-between text-sm font-mono">
                      <span className="text-cyber-text">{item.mediaType}:</span>
                      <span className="text-cyber-accent">{item?.count?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {clearSuccess && (
          <div className="mb-6 bg-cyber-bg-card border-2 border-cyber-accent p-4">
            <div className="text-cyber-accent font-semibold uppercase tracking-wide">
              [OK] DATABASE CLEARED SUCCESSFULLY
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className="bg-cyber-bg-card border-2 border-red-500 p-6">
          <h2 className="text-xl font-semibold text-red-400 uppercase tracking-wider mb-4 border-b border-red-500 pb-2">
            [!] DANGER ZONE
          </h2>

          <p className="text-cyber-text-dim mb-4 font-mono">
            WARNING: THIS WILL DELETE ALL CACHED SERIES, TAGS, AND RELATIONSHIP DATA.
            USER DATA (RATINGS, NOTES, WATCHLISTS) WILL NOT BE AFFECTED.
          </p>

          <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
            <div className="bg-orange-500 p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
              <button
                onClick={handleClearDatabase}
                disabled={isClearing}
                className="px-6 py-3 bg-cyber-bg border border-red-500 text-red-400 hover:bg-red-500 hover:text-black font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                {isClearing ? '[...] CLEARING DATABASE' : '[!!] CLEAR DATABASE'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
