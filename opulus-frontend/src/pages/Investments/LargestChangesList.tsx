import type { HoldingsResponse } from '@opulus/core/dto';
import * as React from 'react';

import { List, ListHeader, ListRow } from '@/common/List';
import {
  amountTone,
  formatSignedMoney,
  formatSignedPercent,
  holdingTitle,
  rangeTitle,
} from '@/utils/investmentDisplay';

/** Holdings shown; the list is for a glance. */
const ROWS = 5;

interface LargestChangesListProps {
  data: HoldingsResponse['data'];
  /** The rows shown are the previous ones, while new ones load. */
  isRefreshing?: boolean;
  /** Open a holding's sheet. */
  onOpenHolding: (holdingId: string) => void;
}

/**
 * The holdings whose value has moved the most since they were bought, the
 * biggest gain first (the server ranks them, in CAD). When little has gained
 * the rows run on into the flat and the losses, so this is not only gains. The
 * ticker and the security's name are on the left, as on Holdings; the amount is on the right with the
 * percentage under it, and only the percentage is coloured (green, red, or
 * neutral for none), as in By account. A row opens the holding's sheet.
 */
export const LargestChangesList: React.FC<LargestChangesListProps> = ({
  data,
  isRefreshing = false,
  onOpenHolding,
}) => {
  // The server ranks them; the ids are looked up here.
  const ranked = data.summary.gainRanking
    .flatMap((id) => {
      const holding = data.holdings.find((entry) => entry.id === id);
      return holding ? [holding] : [];
    })
    .slice(0, ROWS);

  // "Since purchase", or "Past month" and so on.
  const title = data.range === 'all' ? 'Since purchase' : rangeTitle(data);

  return (
    <List aria-label={title} isRefreshing={isRefreshing}>
      <ListHeader title={title} trailingTitle="largest first" />
      {ranked.length === 0 ? (
        <ListRow
          title={
            data.range === 'all' ? 'No cost basis yet' : 'No price history yet'
          }
          subtitle={
            data.range === 'all'
              ? 'Your institutions have not reported what you paid, so there is nothing to compare.'
              : 'There are no prices from the start of this period, so there is nothing to compare.'
          }
        />
      ) : (
        ranked.map((holding) => (
          <ListRow
            key={holding.id}
            title={holdingTitle(holding)}
            subtitle={holding.security.name ?? undefined}
            trailingTitle={formatSignedMoney(
              holding.gainInBase!,
              data.baseCurrency
            )}
            trailingSubtitle={
              holding.gainPercent === null
                ? undefined
                : formatSignedPercent(holding.gainPercent)
            }
            trailingSubtitleTone={amountTone(holding.gainInBase)}
            onClick={() => onOpenHolding(holding.id)}
          />
        ))
      )}
    </List>
  );
};
