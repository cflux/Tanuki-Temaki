import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { userApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export function NotedSeriesPage() {
  const { user, isLoading: authLoading } = useUserStore();
  const navigate = useNavigate();
  const [notedSeries, setNotedSeries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    if (!user) {
      navigate('/');
      return;
    }

    const fetchNoted = async () => {
      try {
        const data = await userApi.getNotedSeries();
        setNotedSeries(data);
      } catch (error) {
        console.error('Failed to fetch noted series:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNoted();
  }, [user, authLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-2 border-cyber-border border-t-cyber-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pt-24 md:pt-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-cyber-text-bright uppercase tracking-widest border-b border-cyber-border pb-4">[NOTE] MY NOTES</h1>

        {notedSeries.length === 0 ? (
          <div className="bg-cyber-bg-card p-8 text-center border border-cyber-border">
            <p className="text-cyber-text-dim mb-4 font-mono uppercase tracking-wide">YOU HAVEN'T ADDED NOTES TO ANY SERIES YET</p>
            <p className="text-sm text-cyber-text-dim font-mono">
              ADD PRIVATE NOTES TO SERIES FROM THE DISCOVERY PAGE
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notedSeries.map((item) => (
              <div
                key={item.id}
                className="bg-cyber-bg-card border border-cyber-border p-6 hover:border-cyber-accent transition-colors"
              >
                <div className="flex gap-4">
                  {item.series.titleImage && (
                    <img
                      src={item.series.titleImage}
                      alt={item.series.title}
                      className="w-32 h-48 object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                      <h3 className="font-semibold text-xl text-cyber-text-bright uppercase tracking-wide">{item.series.title}</h3>
                      <span className="px-2 py-1 bg-transparent border border-cyber-accent text-cyber-accent text-xs uppercase tracking-wide">
                        {item.series.mediaType === 'ANIME' ? '[TV]' : '[BK]'} {item.series.mediaType}
                      </span>
                    </div>

                    <div className="bg-cyber-bg-elevated p-4 mb-3 border border-cyber-border">
                      <div className="text-xs text-cyber-text-dim mb-2 font-mono uppercase tracking-wide">YOUR NOTE:</div>
                      <p className="text-sm text-cyber-text whitespace-pre-wrap font-mono">{item.note}</p>
                    </div>

                    <div className="text-xs text-cyber-text-dim font-mono uppercase tracking-wide">
                      LAST UPDATED {new Date(item.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
