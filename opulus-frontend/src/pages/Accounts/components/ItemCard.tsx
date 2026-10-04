import { ItemPublicDTO } from '@opulus/core';
import React from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  Status,
} from '@/components/ui';
import { getItemStatus } from '@/pages/Accounts/utils/itemStatus';
import { calculateTotalBalance } from '@/utils/accounts';

interface ItemCardProps {
  item: ItemPublicDTO;
  onReconnect: (itemId: string) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onReconnect }) => {
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

      {status.needsReconnect && (
        <Button
          type="button"
          variant={status.variant === 'offline' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onReconnect(item.id)}
          className="shrink-0"
        >
          Reconnect
        </Button>
      )}
    </Card>
  );
};
