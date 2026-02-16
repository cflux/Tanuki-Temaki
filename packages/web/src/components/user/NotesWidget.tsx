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
        className="flex items-center gap-2 text-sm text-cyber-text-dim hover:text-cyber-accent transition-colors uppercase tracking-wide"
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
          {note ? 'EDIT NOTE' : 'ADD NOTE'}
          {note && !isExpanded && (
            <span className="ml-2 text-cyber-text-dim font-mono normal-case">
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
            placeholder="ADD YOUR PRIVATE NOTES..."
            className="w-full px-3 py-2 bg-cyber-bg border border-cyber-border text-cyber-text placeholder-cyber-text-dim focus:outline-none focus:border-cyber-accent focus:shadow-cyber-sm resize-none font-mono transition-all"
            rows={4}
            disabled={isSaving}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || note === (initialNote ?? '')}
                    className="px-4 py-1.5 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-sm font-medium transition-all disabled:border-cyber-border-dim disabled:text-cyber-text-dim disabled:cursor-not-allowed uppercase tracking-wider"
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                  >
                    {saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}
                  </button>
                </div>
              </div>

              {note && (
                <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                    <button
                      onClick={handleDelete}
                      disabled={isSaving}
                      className="px-4 py-1.5 bg-cyber-bg border border-red-500 text-red-400 hover:bg-red-500 hover:text-black text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                      style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              )}

              <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                  <button
                    onClick={() => setIsExpanded(false)}
                    disabled={isSaving}
                    className="px-4 py-1.5 text-cyber-text-dim text-sm hover:text-cyber-accent transition-colors uppercase tracking-wider"
                    style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>

            {/* Status indicator */}
            {saveStatus === 'saved' && (
              <span className="text-sm text-cyber-accent flex items-center gap-1 uppercase tracking-wide">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                SAVED
              </span>
            )}

            {saveStatus === 'error' && (
              <span className="text-sm text-red-500 uppercase tracking-wide">FAILED TO SAVE</span>
            )}
          </div>

          <div className="text-xs text-cyber-text-dim font-mono uppercase tracking-wide">
            {note.length} CHARACTERS
          </div>
        </div>
      )}
    </div>
  );
};
