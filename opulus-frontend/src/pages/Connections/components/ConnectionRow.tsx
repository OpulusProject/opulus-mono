import type { ItemDTO } from '@opulus/core';
import React from 'react';

import { ListRow } from '@/common/ListRow';
import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';
import type { Notice } from '@/types/notice';
import { formatRelativeTime } from '@/utils/date';
import { getStatusNotice } from '@/utils/itemStatus';

import { ConnectionActions } from './ConnectionActions';

interface ConnectionRowProps {
  item: ItemDTO;
  onUpdate: (itemId: string, mode: UpdateMode) => void;
}

export const ConnectionRow: React.FC<ConnectionRowProps> = ({
  item,
  onUpdate,
}) => {
  const accountCount = item.accounts.length;
  // A problem with the connection takes the slot; otherwise point out new accounts.
  const notice: Notice | null =
    getStatusNotice(item.errorCode) ??
    (item.newAccountsAvailable
      ? { text: 'New accounts available', tone: 'muted' }
      : null);

  return (
    <ListRow
      interactive
      institution={item}
      showInstitutionStatus
      title={item.institutionName || 'Unknown Institution'}
      subtitle={`${accountCount} account${accountCount === 1 ? '' : 's'}${
        item.syncedAt
          ? ` · Last synced ${formatRelativeTime(item.syncedAt)}`
          : ''
      }`}
      notices={notice ? [notice] : undefined}
      action={<ConnectionActions item={item} onUpdate={onUpdate} />}
    />
  );
};
