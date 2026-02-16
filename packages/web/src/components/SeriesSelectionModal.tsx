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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-90 backdrop-blur-sm">
      <div className="bg-cyber-bg-elevated border-2 border-cyber-accent max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-cyber-xl">
        {/* Header */}
        <div className="p-6 border-b border-cyber-accent">
          <h2 className="text-2xl font-bold mb-2 text-cyber-text-bright uppercase tracking-widest">MULTIPLE RESULTS FOUND</h2>
          <p className="text-cyber-text-dim text-sm font-mono">
            FOUND {options.length} RESULTS FOR "<span className="text-cyber-text">{searchQuery}</span>".
            SELECT ONE TO EXPLORE:
          </p>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {options.map((option) => {
            const mediaIcon = option.mediaType === 'MANGA' ? '[BOOK]' : '[TV]';
            const mediaBadgeColor = 'bg-transparent border border-cyber-accent text-cyber-accent';

            return (
              <button
                key={option.id}
                onClick={() => onSelect(option.anilistId, option.title)}
                className="w-full flex gap-4 p-4 bg-cyber-bg-card hover:bg-cyber-bg-elevated border border-cyber-border hover:border-cyber-accent transition-all text-left group shadow-cyber-sm hover:shadow-cyber-md"
              >
                {/* Cover Image */}
                <div className="flex-shrink-0">
                  {option.titleImage ? (
                    <div
                      className="bg-cyber-accent flex items-center justify-center"
                      style={{
                        width: 84,
                        height: 114,
                        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                      }}
                    >
                      <img
                        src={option.titleImage}
                        alt={option.title}
                        className="object-cover"
                        style={{
                          width: 80,
                          height: 110,
                          clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="bg-cyber-accent flex items-center justify-center"
                      style={{
                        width: 84,
                        height: 114,
                        clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                      }}
                    >
                      <div
                        className="bg-cyber-bg-elevated flex items-center justify-center text-cyber-text-dim uppercase tracking-wide text-xs"
                        style={{
                          width: 80,
                          height: 110,
                          clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                        }}
                      >
                        NO IMAGE
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Title and badges */}
                  <div className="flex items-start gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs border flex-shrink-0 uppercase tracking-wide ${mediaBadgeColor}`}>
                      {mediaIcon} {option.mediaType}
                    </span>
                    {option.format && (
                      <span className="px-2 py-0.5 bg-transparent border border-cyber-border-dim text-cyber-text-dim text-xs uppercase tracking-wide">
                        {option.format}
                      </span>
                    )}
                    {option.season && option.year && (
                      <span className="px-2 py-0.5 bg-transparent border border-cyber-accent-dim text-cyber-accent-dim text-xs uppercase tracking-wide">
                        {option.season} {option.year}
                      </span>
                    )}
                    {option.year && !option.season && (
                      <span className="px-2 py-0.5 bg-transparent border border-cyber-accent-dim text-cyber-accent-dim text-xs uppercase tracking-wide">
                        {option.year}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-lg text-cyber-text-bright mb-1 group-hover:text-cyber-accent transition-colors uppercase tracking-wide">
                    {option.title}
                  </h3>

                  {/* Metadata */}
                  <div className="flex gap-3 text-xs text-cyber-text-dim mb-2 uppercase tracking-wide font-mono">
                    {option.episodes && <span>[EP] {option.episodes} EPISODES</span>}
                    {option.chapters && <span>[CH] {option.chapters} CHAPTERS</span>}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-cyber-text-dim line-clamp-2 font-mono">
                    {option.description.replace(/<[^>]*>/g, '')}
                  </p>
                </div>

                {/* Select indicator */}
                <div className="flex-shrink-0 flex items-center">
                  <div className="w-8 h-8 border-2 border-cyber-border group-hover:border-cyber-accent flex items-center justify-center transition-colors">
                    <span className="text-cyber-border group-hover:text-cyber-accent transition-colors">→</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-cyber-border flex justify-between items-center">
          <p className="text-sm text-cyber-text-dim uppercase tracking-wide font-mono">
            CLICK ON A SERIES TO EXPLORE
          </p>
          <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
            <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-cyber-bg border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent transition-all uppercase tracking-wider"
                style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
