import { useState, useRef, useEffect } from 'react';
import { useThemeStore, type CyberTheme } from '../store/themeStore';

const themes: Array<{ name: CyberTheme; label: string; color: string }> = [
  { name: 'cyber-green', label: 'MATRIX GREEN', color: '#00FF00' },
  { name: 'cyber-blue', label: 'CYBER BLUE', color: '#00D4FF' },
  { name: 'cyber-purple', label: 'SYNTHWAVE', color: '#D946EF' },
  { name: 'cyber-red', label: 'DYSTOPIA', color: '#FF0040' },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentTheme = themes.find(t => t.name === theme) || themes[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
        <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="h-10 flex items-center gap-2 px-4 bg-cyber-bg border border-cyber-border hover:border-cyber-accent text-cyber-text hover:text-cyber-accent font-medium transition-all uppercase tracking-wide"
            style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            title="Change theme"
          >
            <div
              className="w-4 h-4 border border-cyber-accent"
              style={{ backgroundColor: currentTheme.color }}
            />
            <span className="text-sm">{currentTheme.label}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 z-50" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
          <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
            <div className="bg-cyber-bg-elevated shadow-cyber-lg py-2" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
              {themes.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setTheme(t.name);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors uppercase tracking-wide text-sm ${
                    theme === t.name
                      ? 'bg-cyber-accent text-cyber-bg'
                      : 'bg-cyber-bg text-cyber-text hover:bg-cyber-accent hover:text-cyber-bg'
                  }`}
                >
                  <div
                    className="w-4 h-4 border flex-shrink-0"
                    style={{
                      backgroundColor: t.color,
                      borderColor: theme === t.name ? 'currentColor' : t.color,
                    }}
                  />
                  <span>{t.label}</span>
                  {theme === t.name && <span className="ml-auto">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
