import type { HoldingsResponse } from '@opulus/core/dto';
import { Landmark } from 'lucide-react';
import * as React from 'react';

import { List, ListHeader, ListRow } from '@/common/List';
import { formatMoney } from '@/utils/accountDisplay';
import {
  accountName,
  formatGain,
  formatPercent,
  formatSignedPercent,
  holdingTitle,
} from '@/utils/investmentDisplay';

interface AccountsAndGainsProps {
  data: HoldingsResponse['data'];
  onOpenHolding: (holdingId: string) => void;
}

/** Two short lists side by side: what each account is worth, and what each holding has gained. */
export const AccountsAndGains: React.FC<AccountsAndGainsProps> = ({
  data,
  onOpenHolding,
}) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <ByAccount data={data} />
    <GainByHolding data={data} onOpenHolding={onOpenHolding} />
  </div>
);

const ByAccount: React.FC<{ data: HoldingsResponse['data'] }> = ({ data }) => (
  <List aria-label="By account">
    <ListHeader
      title="By account"
      trailingTitle={`${formatMoney(data.summary.value, data.baseCurrency)} total`}
    />
    {data.accounts.map((account) => (
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
      />
    ))}
  </List>
);

const GainByHolding: React.FC<{
  data: HoldingsResponse['data'];
  onOpenHolding: (holdingId: string) => void;
}> = ({ data, onOpenHolding }) => {
  // The server ranks them; the ids are looked up here.
  const ranked = data.summary.gainRanking.flatMap((id) => {
    const holding = data.holdings.find((entry) => entry.id === id);
    return holding ? [holding] : [];
  });

  return (
    <List aria-label="Gain since purchase">
      <ListHeader title="Gain since purchase" trailingTitle="best to worst" />
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
            subtitle={formatGain(holding.gain!, null, holding.currency)}
            trailingTitle={formatSignedPercent(holding.gainPercent!)}
            onClick={() => onOpenHolding(holding.id)}
            aria-label={`${holdingTitle(holding)}, ${formatSignedPercent(holding.gainPercent!)}`}
          />
        ))
      )}
    </List>
  );
};
