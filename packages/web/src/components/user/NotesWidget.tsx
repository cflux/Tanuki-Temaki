import React, { useState } from 'react';
import { useUserStore } from '../../store/userStore';
import { userApi } from '../../lib/api';
import { useSyncedState } from '../../hooks';
import { STATUS_DISPLAY_DURATION } from '../../config/uiConstants';

interface NotesWidgetProps {
  seriesId: string;
  initialNote?: string | null;
  onNoteChange?: (note: string | null) => void;
}

export const NotesWidget: React.FC<NotesWidgetProps> = ({
  seriesId,
  initialNote,
  onNoteChange,
}) => {
  const user = useUserStore((state) => state.user);
  const [isExpanded, setIsExpanded] = useState(false);
  const [note, setNote] = useSyncedState(initialNote, '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      if (note.trim()) {
        await userApi.saveNote(seriesId, note.trim());
        setSaveStatus('saved');
        onNoteChange?.(note.trim());
      } else {
        // Delete note if empty
        await userApi.deleteNote(seriesId);
        setSaveStatus('saved');
        onNoteChange?.(null);
      }

      // Reset status after brief delay
      setTimeout(() => setSaveStatus('idle'), STATUS_DISPLAY_DURATION.SUCCESS);
    } catch (error) {
      console.error('Failed to save note:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), STATUS_DISPLAY_DURATION.ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await userApi.deleteNote(seriesId);
      setNote('');
      setSaveStatus('saved');
      onNoteChange?.(null);
      setTimeout(() => {
        setSaveStatus('idle');
        setIsExpanded(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to delete note:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), STATUS_DISPLAY_DURATION.ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>
          {note ? 'Edit note' : 'Add note'}
          {note && !isExpanded && (
            <span className="ml-2 text-zinc-500">
              ({note.length > 50 ? `${note.substring(0, 50)}...` : note})
            </span>
          )}
        </span>
      </button>

      {/* Expanded note editor */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add your private notes about this series..."
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            disabled={isSaving}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || note === (initialNote ?? '')}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save'}
              </button>

              {note && (
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              )}

              <button
                onClick={() => setIsExpanded(false)}
                disabled={isSaving}
                className="px-4 py-1.5 text-zinc-400 rounded-lg text-sm hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Status indicator */}
            {saveStatus === 'saved' && (
              <span className="text-sm text-green-500 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Saved
              </span>
            )}

            {saveStatus === 'error' && (
              <span className="text-sm text-red-500">Failed to save</span>
            )}
          </div>

          <div className="text-xs text-zinc-500">
            {note.length} characters
          </div>
        </div>
      )}
    </div>
  );
};
