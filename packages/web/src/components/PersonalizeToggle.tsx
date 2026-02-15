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
    <button
      onClick={handleToggle}
      className={`h-10 px-4 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
        preferPersonalized
          ? 'bg-blue-600 hover:bg-blue-700 text-white'
          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
      }`}
      title={preferPersonalized
        ? 'Recommendations are personalized based on your ratings and tag preferences'
        : 'Enable to personalize recommendations based on your ratings and tag preferences'}
    >
      <span>✨</span>
      <span>{preferPersonalized ? 'Personalized' : 'Personalize'}</span>
    </button>
  );
};
