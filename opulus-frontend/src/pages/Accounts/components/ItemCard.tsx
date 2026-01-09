import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Card,
  CardContent,
  CardHeader,
} from '@gems';
import { ItemPublicDTO } from '@opulus/core';
import React from 'react';

import { calculateTotalBalance } from '@/utils/accounts';

interface ItemCardProps {
  item: ItemPublicDTO;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item }) => {
  // Format base64 logo as data URI if it exists
  const logoUrl = item.institutionLogo
    ? item.institutionLogo.startsWith('data:')
      ? item.institutionLogo
      : `data:image/png;base64,${item.institutionLogo}`
    : null;

  // Calculate metadata from accounts (frontend calculation)
  // Account count includes all accounts (including credit)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const accountCount: number = item.accounts.length;
  // Balance calculation excludes credit accounts
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const totalAvailableBalance: number = calculateTotalBalance(item.accounts);

  // Format currency as CAD (Canadian Dollar)
  // TODO: Currency handling strategy - consider:
  // - User preference/settings for display currency (global setting)
  // - Per-item currency detection from account data
  // - Multi-currency support (show breakdown by currency)
  // - Currency conversion using exchange rates
  // - Locale-based formatting (en-CA vs en-US)
  const formattedBalance = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(totalAvailableBalance);

  return (
    <Card className="w-[310px] p-8">
      <CardHeader className="flex items-center justify-center">
        <Avatar className="size-20">
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
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div>{item.institutionName || 'Unknown Institution'}</div>
        <div className="flex items-center gap-2">
          <span>{formattedBalance}</span>
          <span className="text-sm text-muted-foreground">CAD</span>
        </div>
        <Badge>
          {accountCount} account
          {accountCount !== 1 ? 's' : ''}
        </Badge>
      </CardContent>
    </Card>
  );
};
