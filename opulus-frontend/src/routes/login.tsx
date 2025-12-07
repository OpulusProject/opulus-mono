import { createFileRoute } from '@tanstack/react-router';

import { Login } from '@/pages/Login';

export const Route = createFileRoute('/login')({
  component: Login,
  // Note: If you want to redirect authenticated users away from login,
  // you can add a beforeLoad hook that checks session and redirects
});
