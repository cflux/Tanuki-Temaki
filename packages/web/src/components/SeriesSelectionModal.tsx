import React from 'react';

interface SeriesOption {
  id: string;
  title: string;
  description: string;
  titleImage: string | null;
  mediaType: 'ANIME' | 'MANGA';
  anilistId: number;
  format?: string;
  episodes?: number;
  chapters?: number;
  season?: string;
  year?: number;
}

interface SeriesSelectionModalProps {
  isOpen: boolean;
  searchQuery: string;
  options: SeriesOption[];
  onSelect: (anilistId: number, title: string) => void;
  onCancel: () => void;
}

export const SeriesSelectionModal: React.FC<SeriesSelectionModalProps> = ({
  isOpen,
  searchQuery,
  options,
  onSelect,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-lg border border-zinc-700 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-2xl font-bold mb-2">Multiple Results Found</h2>
          <p className="text-zinc-400 text-sm">
            Found {options.length} results for "<span className="text-zinc-200">{searchQuery}</span>".
            Please select which one you want to explore:
          </p>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {options.map((option) => {
            const mediaIcon = option.mediaType === 'MANGA' ? '📖' : '📺';
            const mediaBadgeColor = option.mediaType === 'MANGA'
              ? 'bg-green-600/20 border-green-600/50 text-green-300'
              : 'bg-blue-600/20 border-blue-600/50 text-blue-300';

            return (
              <button
                key={option.id}
                onClick={() => onSelect(option.anilistId, option.title)}
                className="w-full flex gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-lg transition-all text-left group"
              >
                {/* Cover Image */}
                <div className="flex-shrink-0">
                  {option.titleImage ? (
                    <img
                      src={option.titleImage}
                      alt={option.title}
                      className="object-cover rounded"
                      style={{ width: 80, height: 110 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className="bg-zinc-700 rounded flex items-center justify-center text-zinc-500"
                      style={{ width: 80, height: 110 }}
                    >
                      No Image
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Title and badges */}
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border flex-shrink-0 ${mediaBadgeColor}`}>
                      {mediaIcon} {option.mediaType}
                    </span>
                    {option.format && (
                      <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded text-xs">
                        {option.format}
                      </span>
                    )}
                    {option.season && option.year && (
                      <span className="px-2 py-0.5 bg-purple-600/20 border border-purple-600/50 text-purple-300 rounded text-xs">
                        {option.season} {option.year}
                      </span>
                    )}
                    {option.year && !option.season && (
                      <span className="px-2 py-0.5 bg-purple-600/20 border border-purple-600/50 text-purple-300 rounded text-xs">
                        {option.year}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-lg text-zinc-100 mb-1 group-hover:text-blue-400 transition-colors">
                    {option.title}
                  </h3>

                  {/* Metadata */}
                  <div className="flex gap-3 text-xs text-zinc-400 mb-2">
                    {option.episodes && <span>📺 {option.episodes} episodes</span>}
                    {option.chapters && <span>📚 {option.chapters} chapters</span>}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-zinc-400 line-clamp-2">
                    {option.description.replace(/<[^>]*>/g, '')}
                  </p>
                </div>

                {/* Select indicator */}
                <div className="flex-shrink-0 flex items-center">
                  <div className="w-8 h-8 rounded-full border-2 border-zinc-600 group-hover:border-blue-500 flex items-center justify-center transition-colors">
                    <span className="text-zinc-600 group-hover:text-blue-500 transition-colors">→</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 flex justify-between items-center">
          <p className="text-sm text-zinc-500">
            Click on a series to explore its relationships
          </p>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
