/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    // Override all border-radius to 0px for sharp cyberpunk aesthetic
    borderRadius: {
      none: '0px',
      sm: '0px',
      DEFAULT: '0px',
      md: '0px',
      lg: '0px',
      xl: '0px',
      '2xl': '0px',
      '3xl': '0px',
      full: '0px',
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Cyberpunk color palette using CSS custom properties
        cyber: {
          bg: 'var(--cyber-bg)',
          'bg-elevated': 'var(--cyber-bg-elevated)',
          'bg-card': 'var(--cyber-bg-card)',
          accent: 'var(--cyber-accent)',
          'accent-dim': 'var(--cyber-accent-dim)',
          'accent-bright': 'var(--cyber-accent-bright)',
          text: 'var(--cyber-text)',
          'text-dim': 'var(--cyber-text-dim)',
          'text-bright': 'var(--cyber-text-bright)',
          border: 'var(--cyber-border)',
          'border-dim': 'var(--cyber-border-dim)',
        },
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Consolas',
          'Monaco',
          'Courier New',
          'monospace',
        ],
      },
      boxShadow: {
        'cyber-sm': '0 0 4px var(--cyber-accent)',
        'cyber-md': '0 0 8px var(--cyber-accent)',
        'cyber-lg': '0 0 12px var(--cyber-accent)',
        'cyber-xl': '0 0 20px var(--cyber-accent)',
        'cyber-inner': 'inset 0 0 8px var(--cyber-accent)',
      },
      animation: {
        'cyber-pulse': 'cyber-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scan-line 8s linear infinite',
      },
      keyframes: {
        'cyber-pulse': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 8px var(--cyber-accent)',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 20px var(--cyber-accent)',
          },
        },
        'scan-line': {
          '0%': {
            transform: 'translateY(-100%)',
          },
          '100%': {
            transform: 'translateY(100vh)',
          },
        },
      },
    },
  },
  plugins: [],
};
