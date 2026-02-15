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
        <div className="text-zinc-400">Loading noted series...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">📝 My Notes</h1>

        {notedSeries.length === 0 ? (
          <div className="bg-zinc-900 rounded-lg p-8 text-center border border-zinc-800">
            <p className="text-zinc-400 mb-4">You haven't added notes to any series yet</p>
            <p className="text-sm text-zinc-500">
              Add private notes to series from the discovery page
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notedSeries.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="flex gap-4">
                  {item.series.titleImage && (
                    <img
                      src={item.series.titleImage}
                      alt={item.series.title}
                      className="w-32 h-48 object-cover rounded flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-xl">{item.series.title}</h3>
                      <span className="px-2 py-1 bg-blue-600/20 border border-blue-600/50 text-blue-300 rounded text-xs">
                        {item.series.mediaType}
                      </span>
                    </div>

                    <div className="bg-zinc-800/50 rounded-lg p-4 mb-3 border border-zinc-700">
                      <div className="text-xs text-zinc-500 mb-2">Your Note:</div>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{item.note}</p>
                    </div>

                    <div className="text-xs text-zinc-500">
                      Last updated {new Date(item.updatedAt).toLocaleDateString()}
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
