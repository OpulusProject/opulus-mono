import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const statusVariants = cva(
  'inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        online:
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        degraded:
          'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        offline:
          'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400',
        maintenance:
          'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400',
        unknown:
          'border-muted-foreground/20 bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'online',
    },
  }
);

const dotVariants = cva('size-1.5 rounded-full', {
  variants: {
    variant: {
      online: 'bg-emerald-500',
      degraded: 'bg-amber-500',
      offline: 'bg-red-500',
      maintenance: 'bg-blue-500',
      unknown: 'bg-muted-foreground',
    },
  },
  defaultVariants: { variant: 'online' },
});

type StatusVariant = NonNullable<VariantProps<typeof statusVariants>['variant']>;

interface StatusProps extends React.ComponentProps<'span'> {
  variant?: StatusVariant;
  pulse?: boolean;
}

function Status({ variant, pulse, className, children, ...props }: StatusProps) {
  return (
    <span
      data-slot="status"
      className={cn(statusVariants({ variant }), className)}
      {...props}
    >
      <span className="relative flex size-1.5">
        {pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
              dotVariants({ variant })
            )}
          />
        )}
        <span className={cn('relative', dotVariants({ variant }))} />
      </span>
      {children}
    </span>
  );
}

export { Status, statusVariants, type StatusVariant };
