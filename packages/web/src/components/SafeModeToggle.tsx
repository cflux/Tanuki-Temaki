import React from 'react';
import { useUserStore } from '../store/userStore';

export const SafeModeToggle: React.FC = () => {
  const { filterAdultContent, setFilterAdultContent } = useUserStore();

  const handleToggle = () => {
    setFilterAdultContent(!filterAdultContent);
  };

  return (
    <button
      onClick={handleToggle}
      className={`h-10 px-4 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
        filterAdultContent
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
      }`}
      title={filterAdultContent
        ? 'Safe mode enabled - adult content is filtered out'
        : 'Click to enable safe mode and filter out adult content'}
    >
      <span>{filterAdultContent ? '✓' : '🔞'}</span>
      <span>{filterAdultContent ? 'Safe Mode' : 'All Content'}</span>
    </button>
  );
};
