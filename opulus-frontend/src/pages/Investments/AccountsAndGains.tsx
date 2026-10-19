import type { HoldingsResponse } from '@opulus/core/dto';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListHeader, ListRow } from '@/common/List';
import { formatMoney } from '@/utils/accountDisplay';
import {
  accountLabel,
  accountName,
  amountTone,
  formatGain,
  formatPercent,
  formatSignedMoney,
  formatSignedPercent,
  holdingTitle,
} from '@/utils/investmentDisplay';

/** Rows each list shows. */
const ROWS = 5;

interface AccountsAndGainsProps {
  data: HoldingsResponse['data'];
  /** The rows shown are the previous ones, while new ones load. */
  isRefreshing?: boolean;
  /** Open a holding's sheet, on this page. */
  onOpenHolding: (holdingId: string) => void;
}

/**
 * Two short lists side by side: what each account is worth, and what each
 * holding has gained. A holding opens its sheet over this page.
 */
export const AccountsAndGains: React.FC<AccountsAndGainsProps> = ({
  data,
  isRefreshing = false,
  onOpenHolding,
}) => (
  <div className="grid items-start gap-4 lg:grid-cols-2">
    <ByAccount data={data} isRefreshing={isRefreshing} />
    <GainByHolding
      data={data}
      isRefreshing={isRefreshing}
      onOpen={onOpenHolding}
    />
  </div>
);

const ByAccount: React.FC<{
  data: HoldingsResponse['data'];
  isRefreshing: boolean;
}> = ({ data, isRefreshing }) => (
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

const GainByHolding: React.FC<{
  data: HoldingsResponse['data'];
  isRefreshing: boolean;
  onOpen: (holdingId: string) => void;
}> = ({ data, isRefreshing, onOpen }) => {
  // The server ranks them; the ids are looked up here.
  const ranked = data.summary.gainRanking
    .flatMap((id) => {
      const holding = data.holdings.find((entry) => entry.id === id);
      return holding ? [holding] : [];
    })
    .slice(0, ROWS);

  return (
    <List aria-label="Gain since purchase" isRefreshing={isRefreshing}>
      <ListHeader title="Gain since purchase" trailingTitle="largest first" />
      {ranked.length === 0 ? (
        <ListRow
          title="No cost basis yet"
          subtitle="Your institutions have not reported what you paid, so there is no gain to show."
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
            trailingTitleTone={amountTone(holding.gainInBase)}
            trailingSubtitle={
              holding.gainPercent === null
                ? undefined
                : formatSignedPercent(holding.gainPercent)
            }
            trailingSubtitleTone={amountTone(holding.gainInBase)}
            onClick={() => onOpen(holding.id)}
          />
        ))
      )}
    </List>
  );
};
