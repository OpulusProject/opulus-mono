import type { HoldingDTO, HoldingsResponse } from '@opulus/core/dto';
import { Coins, Gem, Landmark, LineChart, Wallet } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty, ListGroup, ListRow } from '@/common/List';
import type { Notice } from '@/types/notice';
import { formatMoney } from '@/utils/accountDisplay';
import {
  ALLOCATION_LABELS,
  accountLabel,
  amountTone,
  daysUntil,
  formatGain,
  formatPercent,
  holdingTitle,
} from '@/utils/investmentDisplay';

const KIND_ICONS = {
  etf: LineChart,
  stock: LineChart,
  mutualFund: LineChart,
  bond: Landmark,
  option: Gem,
  cash: Wallet,
  other: Coins,
} as const;

interface HoldingsListProps {
  /** The holdings in view (filtered and ordered by the server). */
  data: HoldingsResponse['data'];
  /** The rows shown are the previous ones, while new ones load. */
  isRefreshing?: boolean;
  onOpenHolding: (holdingId: string) => void;
}

/**
 * Every holding but cash, one group per kind (stocks, ETFs, bonds, ...) as on Credit and
 * loans: the largest kind first, each with its total (the server's allocation)
 * and its holdings largest first. Each opens its sheet.
 */
export const HoldingsList: React.FC<HoldingsListProps> = ({
  data,
  isRefreshing = false,
  onOpenHolding,
}) => {
  const groups = data.summary.allocation.flatMap((slice) => {
    if (slice.kind === 'balance' || slice.kind === 'cash') return [];
    const rows = data.holdings.filter(
      (holding) => holding.security.kind === slice.kind
    );
    return rows.length > 0 ? [{ slice, rows }] : [];
  });

  return (
    <List aria-label="Holdings" isRefreshing={isRefreshing}>
      {groups.length === 0 ? (
        <ListEmpty
          icon={Coins}
          title="No holdings to show"
          description="Your institutions have not reported any holdings for these accounts."
        />
      ) : (
        groups.map(({ slice, rows }) => (
          <ListGroup
            key={slice.kind}
            title={ALLOCATION_LABELS[slice.kind]}
            trailingTitle={formatMoney(slice.value, data.baseCurrency)}
          >
            {rows.map((holding) => (
              <HoldingRow
                key={holding.id}
                holding={holding}
                baseCurrency={data.baseCurrency}
                onOpen={() => onOpenHolding(holding.id)}
              />
            ))}
          </ListGroup>
        ))
      )}
    </List>
  );
};

const HoldingRow: React.FC<{
  holding: HoldingDTO;
  baseCurrency: string;
  onOpen: () => void;
}> = ({ holding, baseCurrency, onOpen }) => {
  const { security } = holding;
  const cash = security.kind === 'cash';
  const price = formatMoney(holding.price, holding.currency);

  const detail = cash
    ? null
    : security.kind === 'option' && security.option?.expirationDate
      ? `${holding.quantity} ${holding.quantity === 1 ? 'contract' : 'contracts'}`
      : `${holding.quantity} × ${price}`;
  const subtitle = [
    cash ? null : security.name,
    detail,
    `${holding.accountName} ${accountLabel({ subtype: holding.accountSubtype, mask: holding.accountMask })}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const notices: Notice[] = [];
  if (holding.priceStale) {
    notices.push({ text: 'Price may be out of date', tone: 'warning' });
  }
  const expires = security.option?.expirationDate;
  if (expires) {
    const days = daysUntil(expires);
    if (days >= 0 && days <= 30) {
      notices.push({
        text: days === 0 ? 'Expires today' : `Expires in ${days} days`,
        tone: 'warning',
      });
    }
  }

  return (
    <ListRow
      icon={KIND_ICONS[security.kind]}
      title={holdingTitle(holding)}
      subtitle={subtitle}
      notices={notices}
      trailingTitle={formatMoney(holding.valueInBase, baseCurrency)}
      trailingSubtitle={
        holding.gain === null
          ? cash
            ? formatPercent(holding.share, 0) + ' of total'
            : 'No cost basis'
          : formatGain(holding.gain, holding.gainPercent, holding.currency)
      }
      trailingSubtitleTone={amountTone(holding.gain)}
      onClick={onOpen}
    />
  );
};
