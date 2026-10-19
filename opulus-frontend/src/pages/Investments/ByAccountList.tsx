import type { HoldingsResponse } from '@opulus/core/dto';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListHeader, ListRow } from '@/common/List';
import { formatMoney } from '@/utils/accountDisplay';
import {
  accountName,
  amountTone,
  formatGain,
  formatPercent,
} from '@/utils/investmentDisplay';

/** Accounts shown; the list is for a glance. */
const ROWS = 5;

interface ByAccountListProps {
  data: HoldingsResponse['data'];
  /** The rows shown are the previous ones, while new ones load. */
  isRefreshing?: boolean;
}

/**
 * What each account is worth, its institution and share of the investments,
 * and how it has done since purchase: the change in green, red, or neutral for
 * none. An account that reports only a balance says so.
 */
export const ByAccountList: React.FC<ByAccountListProps> = ({
  data,
  isRefreshing = false,
}) => (
  <List aria-label="By account" isRefreshing={isRefreshing}>
    <ListHeader
      title="By account"
      trailingTitle={`${formatMoney(data.summary.value, data.baseCurrency)} total`}
    />
    {data.accounts.slice(0, ROWS).map((account) => (
      <ListRow
        key={account.id}
        icon={Landmark}
        title={accountName(account)}
        subtitle={[
          account.institutionName,
          `${formatPercent(account.share, 0)} of your investments`,
        ]
          .filter(Boolean)
          .join(' · ')}
        trailingTitle={formatMoney(account.value, data.baseCurrency)}
        trailingSubtitle={
          account.hasHoldings
            ? account.gain === null
              ? 'No cost basis'
              : formatGain(account.gain, account.gainPercent, data.baseCurrency)
            : 'Balance only'
        }
        trailingSubtitleTone={amountTone(account.gain)}
      />
    ))}
  </List>
);
