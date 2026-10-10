import type { TransactionDTO } from '@opulus/core/dto';
import React from 'react';

import { ListRow } from '@/common/List';
import { formatMoney } from '@/utils/accountDisplay';
import { getCategoryIcon, getCategoryLabel } from '@/utils/transactionCategory';

interface TransactionRowProps {
  transaction: TransactionDTO;
}

/** One transaction: the merchant (logo or category icon), where, and the amount. */
export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
}) => {
  const { account, category } = transaction;
  const moneyIn = transaction.amount < 0;
  const amount = formatMoney(
    Math.abs(transaction.amount),
    transaction.isoCurrencyCode
  );

  return (
    <ListRow
      logoUrl={transaction.logoUrl}
      icon={getCategoryIcon(category?.primary)}
      title={transaction.merchantName || transaction.name}
      subtitle={[
        getCategoryLabel(category?.primary),
        `${account.name}${account.mask ? ` ••${account.mask}` : ''}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      notices={
        transaction.pending ? [{ text: 'Pending', tone: 'muted' }] : undefined
      }
      trailingTitle={moneyIn ? `+${amount}` : amount}
    />
  );
};
