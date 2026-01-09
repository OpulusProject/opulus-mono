import { Card, CardDescription, CardHeader, CardTitle } from '@gems';
import * as React from 'react';

import { useItems } from '@/hooks/items/useItems';
import { useTransactions } from '@/hooks/transactions/useTransactions';
import { calculateAvailableCash } from '@/utils/accounts';
import {
  calculateLargestCategory,
  calculateTotalSpending,
} from '@/utils/transactions';

interface StatCardProps {
  description: string;
  value: string;
}

function StatCard({ description, value }: StatCardProps) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export function SectionCards() {
  const { data: itemsData, isLoading: itemsLoading } = useItems();
  const now = React.useMemo(() => new Date(), []);
  const startOfMonth = React.useMemo(() => {
    const date = new Date(now.getFullYear(), now.getMonth(), 1);
    return date;
  }, [now]);
  const endOfMonth = React.useMemo(() => {
    const date = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return date;
  }, [now]);

  const { data: transactionsData, isLoading: transactionsLoading } =
    useTransactions({
      startDate: startOfMonth,
      endDate: endOfMonth,
      limit: 10000, // Get all transactions for the month
    });

  // Calculate available cash (sum of all account balances excluding credit)
  const availableCash: number = React.useMemo((): number => {
    if (!itemsData?.items) {
      return 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return calculateAvailableCash(itemsData.items);
  }, [itemsData]);

  // Calculate spending this month (sum of positive transaction amounts)
  const spendingThisMonth = React.useMemo(() => {
    if (!transactionsData?.transactions) return 0;
    return calculateTotalSpending(transactionsData.transactions);
  }, [transactionsData]);

  // Calculate largest category this month
  const largestCategory = React.useMemo(() => {
    if (!transactionsData?.transactions) return null;
    return calculateLargestCategory(transactionsData.transactions);
  }, [transactionsData]);

  // Format values
  const formattedAvailableCash = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(availableCash));

  const formattedSpending = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(spendingThisMonth));

  const isLoading = itemsLoading || transactionsLoading;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard
        description="Available Cash"
        value={isLoading ? '...' : formattedAvailableCash}
      />
      <StatCard
        description="Spending This Month"
        value={isLoading ? '...' : formattedSpending}
      />
      <StatCard
        description="Largest Category This Month"
        value={isLoading ? '...' : largestCategory || 'N/A'}
      />
      <StatCard description="Credit Utilization" value="35%" />
    </div>
  );
}
