import React from 'react';
import { useUserStore } from '../store/userStore';

export const SafeModeToggle: React.FC = () => {
  const { filterAdultContent, setFilterAdultContent } = useUserStore();

  const handleToggle = () => {
    setFilterAdultContent(!filterAdultContent);
  };

  return (
    <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
      <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
        <button
          onClick={handleToggle}
          className={`h-10 px-4 font-medium transition-all whitespace-nowrap flex items-center gap-2 uppercase tracking-wider ${
            filterAdultContent
              ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-md'
              : 'bg-cyber-bg text-cyber-text-dim border border-cyber-border hover:border-cyber-accent hover:text-cyber-accent'
          }`}
          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
          title={filterAdultContent
            ? 'Safe mode enabled - adult content is filtered out'
            : 'Click to enable safe mode and filter out adult content'}
        >
          <span className="font-bold">{filterAdultContent ? '[OK]' : '[18+]'}</span>
          <span>{filterAdultContent ? 'SAFE MODE' : 'ALL CONTENT'}</span>
        </button>
      </div>
    </div>
  );
};
