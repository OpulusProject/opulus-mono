import { Navigate, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: () => {
    // Redirect unauthenticated users to login
    // TODO: Add session check to redirect authenticated users to /dashboard
    return <Navigate to="/login" replace />;
  },
});
