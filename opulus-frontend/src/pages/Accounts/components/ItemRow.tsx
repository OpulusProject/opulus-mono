import { ItemPublicDTO } from '@opulus/core';
import { MoreHorizontal } from 'lucide-react';
import React from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import type { StatusVariant } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { UpdateMode } from '@/hooks/plaid/useLinkToken';
import { getItemStatus } from '@/pages/Accounts/utils/itemStatus';

interface ItemRowProps {
  item: ItemPublicDTO;
  onUpdate: (itemId: string, mode: UpdateMode) => void;
}

const STATUS_DOT_BG: Record<StatusVariant, string> = {
  online: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  offline: 'bg-red-500',
  maintenance: 'bg-blue-500',
  unknown: 'bg-muted-foreground',
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) return `${diffWk} week${diffWk === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

export const ItemRow: React.FC<ItemRowProps> = ({ item, onUpdate }) => {
  const logoUrl = item.institutionLogo
    ? item.institutionLogo.startsWith('data:')
      ? item.institutionLogo
      : `data:image/png;base64,${item.institutionLogo}`
    : null;

  const status = getItemStatus(item.error?.error_code ?? null);
  const accountCount = item.accounts.length;

  return (
    <div className="hover:bg-muted/40 flex items-center gap-3 px-4 py-3 transition-colors">
      <div className="relative shrink-0">
        <Avatar className="size-9 rounded-[10px]">
          {logoUrl && (
            <AvatarImage
              src={logoUrl}
              alt={item.institutionName || 'Institution'}
              className="rounded-[10px]"
            />
          )}
          <AvatarFallback className="rounded-[10px] text-sm">
            {item.institutionName?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <span
          aria-label={status.label}
          title={status.label}
          className={cn(
            'border-background absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2',
            STATUS_DOT_BG[status.variant],
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {item.institutionName || 'Unknown Institution'}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {accountCount} account{accountCount === 1 ? '' : 's'}
          {item.syncedAt && ` · Last synced ${formatRelativeTime(item.syncedAt)}`}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {status.inlineText ? (
          <span
            className={cn(
              'max-w-[12rem] truncate text-xs font-medium',
              status.variant === 'degraded' &&
                'text-amber-600 dark:text-amber-400',
              status.variant === 'offline' && 'text-destructive',
              status.variant === 'unknown' && 'text-muted-foreground',
            )}
          >
            {status.inlineText}
          </span>
        ) : null}

        <div className="flex w-28 justify-end">
          {status.ctaLabel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onUpdate(item.id, 'reconnect')}
            >
              {status.ctaLabel}
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`Actions for ${item.institutionName || 'this institution'}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                console.log('[disconnect] item', item.id, item.institutionName)
              }
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
