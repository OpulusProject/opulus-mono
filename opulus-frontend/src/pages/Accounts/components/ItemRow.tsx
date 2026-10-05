import { ItemPublicDTO } from '@opulus/core';
import { MoreHorizontal } from 'lucide-react';
import React from 'react';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import type { StatusVariant } from '@/components/ui';
import { useDeleteItem } from '@/hooks/items/useDeleteItem';
import type { UpdateMode } from '@/hooks/plaid/useLinkToken';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/date';
import { getInstitutionLogo } from '@/utils/institution';
import { getItemStatus } from '@/utils/itemStatus';

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

export const ItemRow: React.FC<ItemRowProps> = ({ item, onUpdate }) => {
  const logoUrl = getInstitutionLogo(item);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const { mutate: deleteItem, isPending: isDeleting } = useDeleteItem();
  const institutionName = item.institutionName || 'this institution';

  const status = getItemStatus(item.errorCode);
  const accountCount = item.accounts.length;

  return (
    <div className="hover:bg-muted/40 flex items-center gap-3 px-4 py-3 transition-colors">
      <Avatar className="size-9 shrink-0 rounded-[10px]">
        <AvatarImage
          src={logoUrl ?? undefined}
          alt={item.institutionName || 'Institution'}
        />
        <AvatarFallback className="rounded-[10px] text-sm">
          {item.institutionName?.charAt(0).toUpperCase() || '?'}
        </AvatarFallback>
        <AvatarBadge
          aria-label={status.label}
          title={status.label}
          className={STATUS_DOT_BG[status.variant]}
        />
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {item.institutionName || 'Unknown Institution'}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {accountCount} account{accountCount === 1 ? '' : 's'}
          {item.syncedAt &&
            ` · Last synced ${formatRelativeTime(item.syncedAt)}`}
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
              status.variant === 'unknown' && 'text-muted-foreground'
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
              onSelect={() => setConfirmOpen(true)}
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isDeleting) setConfirmOpen(open);
        }}
      >
        <DialogContent showCloseButton={!isDeleting}>
          <DialogHeader>
            <DialogTitle>Disconnect {institutionName}?</DialogTitle>
            <DialogDescription>
              Opulus will no longer track information for {institutionName}. All
              accounts and transactions for it will be permanently deleted. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() =>
                deleteItem(
                  { itemId: item.id },
                  { onSuccess: () => setConfirmOpen(false) }
                )
              }
            >
              {isDeleting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
