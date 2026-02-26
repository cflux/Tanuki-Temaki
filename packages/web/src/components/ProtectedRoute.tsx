import { Navigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUserStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-2 border-cyber-border border-t-cyber-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
