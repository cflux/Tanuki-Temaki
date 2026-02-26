import type { ButtonHTMLAttributes, ReactNode } from 'react';

const CLIP_SM = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CLIP_MD = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

const VARIANTS = {
  primary: {
    border: 'bg-cyber-accent',
    button: 'bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg',
  },
  secondary: {
    border: 'bg-cyber-border',
    button: 'bg-cyber-bg border border-cyber-border text-cyber-text-dim hover:border-cyber-accent hover:text-cyber-accent',
  },
  danger: {
    border: 'bg-orange-500',
    button: 'bg-cyber-bg border border-red-500 text-red-400 hover:bg-red-500 hover:text-black',
  },
} as const;

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function CyberButton({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: CyberButtonProps) {
  const clip = size === 'sm' ? CLIP_SM : CLIP_MD;
  const { border, button } = VARIANTS[variant];
  const pad = size === 'sm' ? 'px-4 py-2 text-sm' : 'px-6 py-3';

  return (
    <div className="inline-flex" style={{ clipPath: clip }}>
      <div className={`p-[1px] ${border}`} style={{ clipPath: clip }}>
        <button
          className={`${button} ${pad} font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider ${className}`}
          style={{ clipPath: clip }}
          {...props}
        >
          {children}
        </button>
      </div>
    </div>
  );
}
