import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-mono font-bold text-cyber-accent mb-4">404</h1>
      <p className="text-lg text-cyber-text-muted mb-6 font-mono">
        Page not found
      </p>
      <Link
        to="/"
        className="px-6 py-2 border border-cyber-accent text-cyber-accent font-mono text-sm uppercase tracking-wider hover:bg-cyber-accent hover:text-cyber-bg transition-colors"
      >
        [Return Home]
      </Link>
    </div>
  );
}
