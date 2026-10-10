import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { cn } from '@/lib/utils';

interface AccountSectionProps {
  title: string;
  description: string;
  /** Style the section as a danger zone. */
  destructive?: boolean;
  children: React.ReactNode;
}

/** The card every section of the account page sits in. */
export const AccountSection: React.FC<AccountSectionProps> = ({
  title,
  description,
  destructive,
  children,
}) => (
  <Card className={cn(destructive && 'border-destructive/40')}>
    <CardHeader>
      <CardTitle className={cn(destructive && 'text-destructive')}>
        {title}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
