import { createFileRoute } from '@tanstack/react-router';

import { Institutions } from '@/pages/Institutions';

export const Route = createFileRoute('/settings/institutions')({
  component: Institutions,
});
