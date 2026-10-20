import type { HoldingsResponse } from '@opulus/core/dto';
import * as React from 'react';

import { List, ListHeader, ListRow } from '@/common/List';
import {
  accountLabel,
  amountTone,
  formatSignedMoney,
  formatSignedPercent,
  holdingTitle,
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
 * ticker and its account are on the left; the amount is on the right with the
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

  return (
    <List aria-label="Since purchase" isRefreshing={isRefreshing}>
      <ListHeader title="Since purchase" trailingTitle="largest first" />
      {ranked.length === 0 ? (
        <ListRow
          title="No cost basis yet"
          subtitle="Your institutions have not reported what you paid, so there is nothing to compare."
        />
      ) : (
        ranked.map((holding) => (
          <ListRow
            key={holding.id}
            title={holdingTitle(holding)}
            subtitle={accountLabel({
              subtype: holding.accountSubtype,
              mask: holding.accountMask,
            })}
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
