import type { HoldingDTO, HoldingsResponse } from '@opulus/core/dto';
import { TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { List, ListRow } from '@/common/List';
import {
  Badge,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui';
import { useActivity } from '@/hooks/investments/useActivity';
import { useHoldings } from '@/hooks/investments/useHoldings';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/accountDisplay';
import {
  KIND_LABELS,
  accountLabel,
  activityIcon,
  activitySubtitle,
  activityTitle,
  daysUntil,
  formatGain,
  formatLongDay,
  formatPercent,
  formatShortDay,
  formatSignedMoney,
  gainTone,
  holdingTitle,
  timeUntil,
} from '@/utils/investmentDisplay';

interface HoldingSheetProps {
  data: HoldingsResponse['data'];
  /** The holding to show, or undefined for the sheet to be closed. */
  holdingId: string | undefined;
  onClose: () => void;
}

/**
 * One holding in detail, in a sheet over the page: what it is worth and has
 * gained, its terms (an ETF or stock's shares and cost; a bond's coupon and
 * maturity; an option's strike and expiry), what happened in it, and where it
 * is held.
 */
export const HoldingSheet: React.FC<HoldingSheetProps> = ({
  data,
  holdingId,
  onClose,
}) => {
  const holding = data.holdings.find((entry) => entry.id === holdingId);

  return (
    <Sheet open={!!holding} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        // Floats 8px in from the edges with rounded corners, as in the design.
        className="inset-y-2 right-2 h-auto w-[calc(100%-1rem)] overflow-y-auto rounded-xl border sm:max-w-md"
      >
        {holding && <HoldingDetail holding={holding} data={data} />}
      </SheetContent>
    </Sheet>
  );
};

const HoldingDetail: React.FC<{
  holding: HoldingDTO;
  data: HoldingsResponse['data'];
}> = ({ holding, data }) => {
  const { security } = holding;
  const { baseCurrency } = data;
  const foreign = holding.currency && holding.currency !== baseCurrency;
  // The same security in other accounts: the server finds them.
  const heldIn = useHoldings({ securityId: security.id }).data?.holdings ?? [
    holding,
  ];

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="text-lg">{holdingTitle(holding)}</SheetTitle>
        <SheetDescription>{security.name}</SheetDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline">{KIND_LABELS[security.kind]}</Badge>
          {holding.currency && (
            <Badge variant="outline">{holding.currency}</Badge>
          )}
          {security.exchange && (
            <Badge variant="outline">{security.exchange}</Badge>
          )}
          {security.option?.expirationDate &&
            daysUntil(security.option.expirationDate) >= 0 && (
              <Badge
                variant="outline"
                className="text-amber-600 dark:text-amber-400"
              >
                Expires in {daysUntil(security.option.expirationDate)} days
              </Badge>
            )}
        </div>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-4 pb-6">
        <section aria-label="Your position" className="flex flex-col gap-1">
          <div className="text-muted-foreground text-xs">Your position</div>
          <div className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatMoney(holding.valueInBase, baseCurrency)}
          </div>
          {foreign && (
            <div className="text-muted-foreground text-xs tabular-nums">
              {formatMoney(holding.value, holding.currency)}
            </div>
          )}
          {holding.gain !== null && (
            <div className="flex items-center gap-2 pt-1">
              <Badge
                variant="secondary"
                className={cn('tabular-nums', gainTone(holding.gain))}
              >
                {formatGain(
                  holding.gain,
                  holding.gainPercent,
                  holding.currency
                )}
              </Badge>
              <span className="text-muted-foreground text-xs">
                since purchase
              </span>
            </div>
          )}
        </section>

        <Terms holding={holding} baseCurrency={baseCurrency} />

        {security.kind === 'option' && (
          <div
            role="note"
            className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>
              An option can lose all its value on the day it expires. Opulus
              shows the price your institution reports and does not model what
              it may be worth.
            </span>
          </div>
        )}

        {security.kind !== 'cash' && <HoldingActivity holding={holding} />}

        <section aria-label="Where you hold it" className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Where you hold it</h3>
          <List>
            {heldIn.map((entry) => (
              <ListRow
                key={entry.id}
                title={entry.accountName}
                subtitle={`${accountLabel({ subtype: entry.accountSubtype, mask: entry.accountMask })}${entry.institutionName ? ` · ${entry.institutionName}` : ''} · ${entry.quantity} ${unitLabel(entry)}`}
                trailingTitle={formatMoney(entry.valueInBase, baseCurrency)}
              />
            ))}
          </List>
        </section>
      </div>
    </>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-baseline justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right font-medium tabular-nums">{children}</dd>
  </div>
);

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-muted-foreground ml-1 font-normal">{children}</span>
);

/** The facts that differ by kind of holding. */
const Terms: React.FC<{ holding: HoldingDTO; baseCurrency: string }> = ({
  holding,
  baseCurrency,
}) => {
  const { security } = holding;
  const price = (
    <>
      {formatMoney(holding.price, holding.currency)}
      {holding.priceAsOf && (
        <Muted>as of {formatShortDay(holding.priceAsOf)}</Muted>
      )}
      {!holding.priceAsOf && <Muted>date unknown</Muted>}
    </>
  );
  const basis =
    holding.costBasis === null
      ? 'Not reported'
      : formatMoney(holding.costBasis, holding.currency);

  if (security.bond) {
    const { bond } = security;
    return (
      <dl aria-label="Bond terms">
        {bond.faceValue !== null && (
          <Row label="Face value">
            {formatMoney(bond.faceValue, holding.currency)}
          </Row>
        )}
        <Row label="Price">{price}</Row>
        {bond.yieldRate !== null && (
          <Row
            label={bond.yieldType === 'coupon' ? 'Coupon' : 'Yield to maturity'}
          >
            {bond.yieldRate}%
            {bond.yieldType === 'coupon' && <Muted>a year</Muted>}
          </Row>
        )}
        {bond.maturityDate && (
          <Row label="Matures">
            {formatLongDay(bond.maturityDate)}
            <Muted>{timeUntil(bond.maturityDate)}</Muted>
          </Row>
        )}
        <Row label="Cost basis">{basis}</Row>
      </dl>
    );
  }

  if (security.option) {
    const { option } = security;
    return (
      <dl aria-label="Option contract">
        <Row label="Type">
          {option.contractType === 'put' ? 'Put' : 'Call'}, {holding.quantity}{' '}
          {holding.quantity === 1 ? 'contract' : 'contracts'}
        </Row>
        {option.strikePrice !== null && (
          <Row label="Strike price">
            {formatMoney(option.strikePrice, holding.currency)}
          </Row>
        )}
        {option.expirationDate && (
          <Row label="Expires">{formatLongDay(option.expirationDate)}</Row>
        )}
        <Row label="Price">
          {price}
          <Muted>a share</Muted>
        </Row>
        {option.underlyingTicker && (
          <Row label="Underlying">{option.underlyingTicker}</Row>
        )}
        <Row label="Cost basis">{basis}</Row>
      </dl>
    );
  }

  if (security.kind === 'cash') {
    return (
      <dl aria-label="Cash">
        <Row label="Balance">
          {formatMoney(holding.value, holding.currency)}
        </Row>
      </dl>
    );
  }

  return (
    <dl aria-label="Position details">
      <Row label="Shares">{holding.quantity}</Row>
      <Row label="Price">{price}</Row>
      {holding.costBasis !== null && holding.quantity > 0 && (
        <Row label="Average cost per share">
          {formatMoney(holding.costBasis / holding.quantity, holding.currency)}
        </Row>
      )}
      <Row label="Cost basis">{basis}</Row>
      {holding.dividends > 0 && (
        <Row label="Dividends received">
          {formatMoney(holding.dividends, baseCurrency)}
          <Muted>12 months</Muted>
        </Row>
      )}
      <Row label="Share of your portfolio">{formatPercent(holding.share)}</Row>
    </dl>
  );
};

/** The latest transactions in this security, with a link to all of them. */
const HoldingActivity: React.FC<{ holding: HoldingDTO }> = ({ holding }) => {
  const { data } = useActivity(
    { securityId: holding.security.id },
    { limit: 5 }
  );
  const items = data?.pages[0]?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Activity in this holding"
      className="flex flex-col gap-2"
    >
      <h3 className="text-sm font-semibold">Activity in this holding</h3>
      <List>
        {items.map((item) => (
          <ListRow
            key={item.id}
            icon={activityIcon(item.kind)}
            title={activityTitle(item)}
            subtitle={activitySubtitle(item)}
            trailingTitle={formatSignedMoney(item.amount, item.currency)}
          />
        ))}
      </List>
    </section>
  );
};

/** "2 contracts", "1 unit": what a count of this holding is called. */
function unitLabel(holding: HoldingDTO): string {
  const noun = holding.security.kind === 'option' ? 'contract' : 'unit';
  return `${noun}${holding.quantity === 1 ? '' : 's'}`;
}
