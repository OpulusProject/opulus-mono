import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { ListEmpty } from '@/common/List';
import { Button } from '@/components/ui';

interface DashboardEmptyProps {
  icon: LucideIcon;
  /** Nothing is connected, so the section is empty for that reason. */
  noConnections: boolean;
  /** What an empty section means once something is connected. */
  title: string;
  description: string;
}

/** A section's empty state: connect an account, or the section's own message. */
export const DashboardEmpty: React.FC<DashboardEmptyProps> = ({
  icon,
  noConnections,
  title,
  description,
}) =>
  noConnections ? (
    <ListEmpty
      icon={icon}
      title="No connections yet"
      description="Connect an account to see this here."
      action={
        <Button asChild>
          <Link to="/settings/connections">Go to connections</Link>
        </Button>
      }
    />
  ) : (
    <ListEmpty icon={icon} title={title} description={description} />
  );
