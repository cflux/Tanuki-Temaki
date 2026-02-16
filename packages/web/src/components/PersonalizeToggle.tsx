import React from 'react';
import { useUserStore } from '../store/userStore';
import { userApi } from '../lib/api';

export const PersonalizeToggle: React.FC = () => {
  const { user, preferPersonalized, setPreferPersonalized } = useUserStore();

  if (!user) {
    return null; // Only show for logged-in users
  }

  const handleToggle = async () => {
    const newValue = !preferPersonalized;
    setPreferPersonalized(newValue);

    // Save to backend
    try {
      await userApi.setPreference('prefer_personalized', newValue);
    } catch (error) {
      console.error('Failed to save personalization preference:', error);
      // Revert on error
      setPreferPersonalized(!newValue);
    }
  };

  return (
    <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
      <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
        <button
          onClick={handleToggle}
          className={`h-10 px-4 font-medium transition-all whitespace-nowrap flex items-center gap-2 uppercase tracking-wider ${
            preferPersonalized
              ? 'bg-cyber-accent text-cyber-bg border border-cyber-accent shadow-cyber-md'
              : 'bg-cyber-bg text-cyber-text-dim border border-cyber-border hover:border-cyber-accent hover:text-cyber-accent'
          }`}
          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
          title={preferPersonalized
            ? 'Recommendations are personalized based on your ratings and tag preferences'
            : 'Enable to personalize recommendations based on your ratings and tag preferences'}
        >
          <span className="font-bold">{preferPersonalized ? '[AI]' : '[ ]'}</span>
          <span>{preferPersonalized ? 'PERSONALIZED' : 'PERSONALIZE'}</span>
        </button>
      </div>
    </div>
  );
};
