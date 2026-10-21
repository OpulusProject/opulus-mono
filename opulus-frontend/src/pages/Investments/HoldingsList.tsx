import type { HoldingsResponse, PositionDTO } from '@opulus/core/dto';
import { Coins, Gem, Landmark, LineChart, Wallet } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty, ListGroup, ListRow } from '@/common/List';
import type { Notice } from '@/types/notice';
import { formatMoney } from '@/utils/accountDisplay';
import {
  ALLOCATION_LABELS,
  amountTone,
  daysUntil,
  formatGain,
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
 * Every position but cash, one group per kind (stocks, ETFs, bonds, ...) as on
 * Credit and loans: the largest kind first, each with its total (the server's
 * allocation) and its positions largest first. A security held in several
 * accounts is one row, added up by the server. Each opens its sheet.
 */
export const HoldingsList: React.FC<HoldingsListProps> = ({
  data,
  isRefreshing = false,
  onOpenHolding,
}) => {
  const groups = data.summary.allocation.flatMap((slice) => {
    if (slice.kind === 'balance' || slice.kind === 'cash') return [];
    const rows = data.positions.filter(
      (position) => position.security.kind === slice.kind
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
            {rows.map((position) => (
              <PositionRow
                key={position.security.id}
                position={position}
                baseCurrency={data.baseCurrency}
                onOpen={() => onOpenHolding(position.holdingIds[0])}
              />
            ))}
          </ListGroup>
        ))
      )}
    </List>
  );
};

const PositionRow: React.FC<{
  position: PositionDTO;
  baseCurrency: string;
  onOpen: () => void;
}> = ({ position, baseCurrency, onOpen }) => {
  const { security } = position;
  const notices: Notice[] = [];
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
      title={holdingTitle(position)}
      subtitle={security.name ?? undefined}
      notices={notices}
      trailingTitle={formatMoney(position.valueInBase, baseCurrency)}
      trailingSubtitle={
        position.gainInBase === null
          ? 'No cost basis'
          : formatGain(position.gainInBase, position.gainPercent, baseCurrency)
      }
      trailingSubtitleTone={amountTone(position.gainInBase)}
      onClick={onOpen}
    />
  );
};
