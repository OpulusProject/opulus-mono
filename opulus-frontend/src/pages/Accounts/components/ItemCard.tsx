import { ItemPublicDTO } from '@opulus/core';
import { MoreHorizontal, RefreshCw } from 'lucide-react';
import React from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Status,
} from '@/components/ui';
import type { UpdateMode } from '@/hooks/plaid/useLinkToken';
import { getItemStatus } from '@/pages/Accounts/utils/itemStatus';
import { calculateTotalBalance } from '@/utils/accounts';

interface ItemCardProps {
  item: ItemPublicDTO;
  onUpdate: (itemId: string, mode: UpdateMode) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onUpdate }) => {
  const logoUrl = item.institutionLogo
    ? item.institutionLogo.startsWith('data:')
      ? item.institutionLogo
      : `data:image/png;base64,${item.institutionLogo}`
    : null;

  const accountCount = item.accounts.length;
  const totalAvailableBalance = calculateTotalBalance(item.accounts);
  const formattedBalance = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(totalAvailableBalance);

  const status = getItemStatus(item.errorCode);

  return (
    <Card className="flex flex-row items-center gap-4 p-4">
      <Avatar className="size-10 shrink-0">
        {logoUrl && (
          <AvatarImage
            src={logoUrl}
            alt={item.institutionName || 'Institution'}
          />
        )}
        <AvatarFallback>
          {item.institutionName?.charAt(0).toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {item.institutionName || 'Unknown Institution'}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Status variant={status.variant} pulse={status.needsReconnect}>
            {status.label}
          </Status>
          <Badge variant="secondary">
            {accountCount} account{accountCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <div className="font-medium tabular-nums">{formattedBalance}</div>
        <div className="text-xs text-muted-foreground">CAD</div>
      </div>

      {/*
        Reconnect is currently the only per-item action, so the kebab menu
        is hidden until the item needs it. Future actions (add-accounts on
        a Plaid webhook signal, destructive disconnect) will slot in here.
      */}
      {status.needsReconnect && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={`Actions for ${item.institutionName || 'this institution'}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onUpdate(item.id, 'reconnect')}>
              <RefreshCw className="size-4" />
              Reconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Card>
  );
};
