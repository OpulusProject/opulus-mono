import * as React from 'react';

import { cn } from '@/lib/utils';

interface ExampleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
}

/**
 * ExampleCard - A simple example component demonstrating the library pattern
 *
 * This is a placeholder component showing how to structure components in the library.
 * Replace with your actual reusable components.
 */
const ExampleCard = React.forwardRef<HTMLDivElement, ExampleCardProps>(
  ({ className, title, description, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border bg-card p-6 text-card-foreground shadow-sm',
          className
        )}
        {...props}
      >
        {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}
        {children}
      </div>
    );
  }
);
ExampleCard.displayName = 'ExampleCard';

export { ExampleCard };

