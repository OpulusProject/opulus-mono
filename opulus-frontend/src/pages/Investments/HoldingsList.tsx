import type {
  HoldingDTO,
  HoldingsAccountDTO,
  HoldingsResponse,
} from '@opulus/core/dto';
import { Coins, Gem, Landmark, LineChart, Wallet } from 'lucide-react';
import * as React from 'react';

import { List, ListEmpty, ListGroup, ListHeader, ListRow } from '@/common/List';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui';
import type { Notice } from '@/types/notice';
import { formatMoney } from '@/utils/accountDisplay';
import {
  accountLabel,
  amountTone,
  daysUntil,
  formatGain,
  formatPercent,
  holdingTitle,
} from '@/utils/investmentDisplay';

import type { InvestmentsSearch } from './searchSchema';

const ALL_TYPES = 'all';

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
  /** Account subtypes to pick from, e.g. ["tfsa", "rrsp"]. */
  subtypes: string[];
  layout: InvestmentsSearch['layout'];
  type: string | undefined;
  onLayoutChange: (layout: InvestmentsSearch['layout']) => void;
  onTypeChange: (type: string | undefined) => void;
  onOpenHolding: (holdingId: string) => void;
}

/**
 * Every holding, largest first, as one list or grouped by account, and limited
 * to one kind of account (TFSA, RRSP, ...). Each opens its sheet.
 */
export const HoldingsList: React.FC<HoldingsListProps> = ({
  data,
  isRefreshing = false,
  subtypes,
  layout,
  type,
  onLayoutChange,
  onTypeChange,
  onOpenHolding,
}) => {
  const holdings = data.holdings;

  const row = (holding: HoldingDTO, showAccount: boolean) => (
    <HoldingRow
      key={holding.id}
      holding={holding}
      baseCurrency={data.baseCurrency}
      showAccount={showAccount}
      onOpen={() => onOpenHolding(holding.id)}
    />
  );

  return (
    <List aria-label="Holdings" isRefreshing={isRefreshing}>
      <ListHeader
        title="Holdings"
        trailingTitle={`${holdings.length}`}
        action={
          <div className="flex items-center gap-2">
            {subtypes.length > 1 && (
              <Select
                value={type ?? ALL_TYPES}
                onValueChange={(value) =>
                  onTypeChange(value === ALL_TYPES ? undefined : value)
                }
              >
                <SelectTrigger
                  size="sm"
                  className="w-28"
                  aria-label="Account type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All types</SelectItem>
                  {subtypes.map((subtype) => (
                    <SelectItem key={subtype} value={subtype}>
                      {accountLabel({ subtype, mask: null })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={layout ?? 'list'}
              onValueChange={(value) => {
                if (value)
                  onLayoutChange(value === 'accounts' ? 'accounts' : undefined);
              }}
              aria-label="Layout"
            >
              <ToggleGroupItem value="list">List</ToggleGroupItem>
              <ToggleGroupItem value="accounts">By account</ToggleGroupItem>
            </ToggleGroup>
          </div>
        }
      />
      {holdings.length === 0 ? (
        <ListEmpty
          icon={Coins}
          title="No holdings to show"
          description="Your institutions have not reported any holdings for these accounts."
        />
      ) : layout === 'accounts' ? (
        byAccount(holdings, data.accounts).map(({ account, rows }) => (
          <ListGroup
            key={account.id}
            title={`${account.name} · ${accountLabel(account)}`}
            trailingTitle={formatMoney(account.value, data.baseCurrency)}
          >
            {rows.map((holding) => row(holding, false))}
          </ListGroup>
        ))
      ) : (
        holdings.map((holding) => row(holding, true))
      )}
    </List>
  );
};

const HoldingRow: React.FC<{
  holding: HoldingDTO;
  baseCurrency: string;
  showAccount: boolean;
  onOpen: () => void;
}> = ({ holding, baseCurrency, showAccount, onOpen }) => {
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
    showAccount
      ? `${holding.accountName} ${accountLabel({ subtype: holding.accountSubtype, mask: holding.accountMask })}`
      : null,
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

/**
 * Put a heading between the rows of different accounts. The server sends them
 * account by account (`sort=account`), so each account's rows are adjacent.
 */
function byAccount(holdings: HoldingDTO[], accounts: HoldingsAccountDTO[]) {
  const groups: { account: HoldingsAccountDTO; rows: HoldingDTO[] }[] = [];
  for (const holding of holdings) {
    const last = groups[groups.length - 1];
    if (last?.account.id === holding.accountId) {
      last.rows.push(holding);
    } else {
      const account = accounts.find((entry) => entry.id === holding.accountId);
      if (account) groups.push({ account, rows: [holding] });
    }
  }
  return groups;
}
