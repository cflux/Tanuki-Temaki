/**
 * Cyberpunk UI Class Patterns
 * Reusable class string constants for consistent cyberpunk styling
 */

// Base card styles
export const cyberCard = {
  static: 'bg-cyber-bg-card border border-cyber-border p-4',
  interactive: 'bg-cyber-bg-card border border-cyber-border p-4 hover:border-cyber-accent transition-colors cursor-pointer',
  elevated: 'bg-cyber-bg-elevated border border-cyber-border p-4',
};

// Button styles
export const cyberButton = {
  primary: 'bg-transparent border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg px-4 py-2 uppercase tracking-wider font-medium transition-all hover:shadow-cyber-md',
  secondary: 'bg-transparent border border-cyber-border text-cyber-text hover:border-cyber-accent hover:text-cyber-accent px-4 py-2 uppercase tracking-wider font-medium transition-colors',
  danger: 'bg-transparent border border-red-500 text-red-500 hover:bg-red-500 hover:text-black px-4 py-2 uppercase tracking-wider font-medium transition-all',
  ghost: 'text-cyber-text hover:text-cyber-accent hover:bg-cyber-bg-elevated px-4 py-2 uppercase tracking-wider font-medium transition-colors',
  active: 'bg-cyber-accent text-cyber-bg border border-cyber-accent px-4 py-2 uppercase tracking-wider font-medium shadow-cyber-md',
};

// Input and textarea styles
export const cyberInput = {
  base: 'bg-cyber-bg border border-cyber-border text-cyber-text placeholder-cyber-text-dim px-3 py-2 focus:outline-none focus:border-cyber-accent focus:shadow-cyber-sm transition-all font-mono',
  textarea: 'bg-cyber-bg border border-cyber-border text-cyber-text placeholder-cyber-text-dim px-3 py-2 focus:outline-none focus:border-cyber-accent focus:shadow-cyber-sm transition-all font-mono resize-none',
  search: 'bg-cyber-bg border border-cyber-border text-cyber-text placeholder-cyber-text-dim px-4 py-2 focus:outline-none focus:border-cyber-accent focus:shadow-cyber-sm transition-all font-mono w-full',
};

// Badge and label styles
export const cyberBadge = {
  default: 'bg-transparent border border-cyber-border text-cyber-text-dim px-2 py-1 text-xs uppercase tracking-wide',
  accent: 'bg-transparent border border-cyber-accent text-cyber-accent px-2 py-1 text-xs uppercase tracking-wide shadow-cyber-sm',
  active: 'bg-cyber-accent text-cyber-bg border border-cyber-accent px-2 py-1 text-xs uppercase tracking-wide',
};

// Header and section styles
export const cyberHeader = {
  page: 'text-cyber-text-bright text-2xl uppercase tracking-widest font-bold border-b border-cyber-border pb-2 mb-4',
  section: 'text-cyber-text text-lg uppercase tracking-wider font-semibold border-b border-cyber-border-dim pb-2 mb-3',
  subsection: 'text-cyber-text-dim text-sm uppercase tracking-wide font-medium mb-2',
};

// Modal and overlay styles
export const cyberModal = {
  overlay: 'fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm',
  container: 'bg-cyber-bg-elevated border-2 border-cyber-accent shadow-cyber-xl p-6',
  header: 'text-cyber-text-bright text-xl uppercase tracking-widest font-bold border-b border-cyber-accent pb-3 mb-4',
  footer: 'border-t border-cyber-border pt-4 mt-4 flex gap-3 justify-end',
};

// Divider styles
export const cyberDivider = {
  horizontal: 'border-t border-cyber-border my-4',
  vertical: 'border-l border-cyber-border mx-4',
  accent: 'border-t border-cyber-accent my-4',
};

// Toggle and checkbox styles
export const cyberToggle = {
  button: 'border border-cyber-border text-cyber-text-dim px-3 py-1.5 uppercase text-sm tracking-wide transition-all hover:border-cyber-accent hover:text-cyber-accent',
  active: 'border border-cyber-accent text-cyber-accent bg-cyber-bg-elevated px-3 py-1.5 uppercase text-sm tracking-wide shadow-cyber-sm',
};

// Cover image styles
export const cyberCover = {
  container: 'border border-cyber-border overflow-hidden relative',
  image: 'w-full h-full object-cover',
  overlay: 'absolute inset-0 bg-gradient-to-t from-cyber-bg via-transparent to-transparent opacity-60',
  interactive: 'border border-cyber-border overflow-hidden relative hover:border-cyber-accent transition-colors cursor-pointer group',
  imageHover: 'w-full h-full object-cover group-hover:shadow-cyber-md transition-shadow',
};

// Table and list styles
export const cyberTable = {
  container: 'border border-cyber-border',
  header: 'bg-cyber-bg-elevated border-b border-cyber-accent text-cyber-text-bright uppercase tracking-wider text-xs font-semibold',
  row: 'border-b border-cyber-border-dim hover:bg-cyber-bg-elevated transition-colors',
  cell: 'px-4 py-3 text-cyber-text',
};

// Loading and progress styles
export const cyberLoading = {
  spinner: 'border-2 border-cyber-border border-t-cyber-accent animate-spin',
  bar: 'bg-cyber-bg-elevated border border-cyber-border overflow-hidden',
  progress: 'bg-cyber-accent h-full transition-all shadow-cyber-sm',
  text: 'text-cyber-text-dim uppercase tracking-wide text-sm animate-cyber-pulse',
};

// Link styles
export const cyberLink = {
  default: 'text-cyber-accent hover:text-cyber-accent-bright underline decoration-cyber-border hover:decoration-cyber-accent transition-colors',
  subtle: 'text-cyber-text hover:text-cyber-accent transition-colors',
  nav: 'text-cyber-text-dim hover:text-cyber-accent uppercase tracking-wide transition-colors',
};
