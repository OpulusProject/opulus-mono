'use client';

import type { Transaction } from '@opulus/core';
import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { useTransactions } from '@/hooks/transactions/useTransactions';

const chartConfig = {
  spending: {
    label: 'Spending',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function SpendingChart() {
  const [timeRange, setTimeRange] = React.useState('90d');

  // Calculate date range based on timeRange
  const endDate = React.useMemo(() => new Date(), []);
  const startDate = React.useMemo(() => {
    const date = new Date();
    let daysToSubtract = 90;
    if (timeRange === '30d') {
      daysToSubtract = 30;
    } else if (timeRange === '7d') {
      daysToSubtract = 7;
    }
    date.setDate(date.getDate() - daysToSubtract);
    return date;
  }, [timeRange]);

  // Fetch transactions for the date range
  // Use a high limit to get all transactions in the range
  const { data: transactionsData, isLoading } = useTransactions({
    startDate,
    endDate,
    limit: 10000, // High limit to get all transactions in range
  });

  // Aggregate transactions by date (only spending - positive amounts)
  // Plaid convention: positive = money out (spending), negative = money in (income)
  const chartData = React.useMemo(() => {
    if (
      !transactionsData?.transactions ||
      transactionsData.transactions.length === 0
    ) {
      return [];
    }

    // Group transactions by date and sum spending (positive amounts = money out)
    const spendingByDate = new Map<string, number>();

    transactionsData.transactions.forEach((transaction: Transaction) => {
      const amount = Number(transaction.amount);
      // Only include positive amounts (money out/spending per Plaid convention)
      // Positive values = money moves out of account = spending
      if (amount > 0) {
        const dateStr = transaction.date.split('T')[0]; // Get YYYY-MM-DD part
        const current = spendingByDate.get(dateStr) || 0;
        // Add the positive amount directly (already positive, no need for Math.abs)
        spendingByDate.set(dateStr, current + amount);
      }
      // Ignore negative amounts (money in/income) for spending chart
    });

    // Convert to array and sort by date
    const data = Array.from(spendingByDate.entries())
      .map(([date, spending]) => ({
        date,
        spending, // Already positive since we filtered for amount > 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return data;
  }, [transactionsData]);

  console.log(chartData, 'chartData');

  if (isLoading) {
    return (
      <Card className="pt-0">
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
          <div className="grid flex-1 gap-1">
            <CardTitle>Spending over time</CardTitle>
            <CardDescription>
              Your total spending across the selected period
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="pt-0">
        <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
          <div className="grid flex-1 gap-1">
            <CardTitle>Spending over time</CardTitle>
            <CardDescription>
              Your total spending across the selected period
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-muted-foreground">No spending data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Spending over time</CardTitle>
          <CardDescription>
            Your total spending across the selected period
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select a time range"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 3 months
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart
            data={chartData}
            margin={{
              left: -20,
              right: 12,
            }}
          >
            <defs>
              <linearGradient id="fillSpending" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-spending)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-spending)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string | number | Date) => {
                const date =
                  typeof value === 'string'
                    ? new Date(value)
                    : typeof value === 'number'
                      ? new Date(value)
                      : value;
                return date instanceof Date
                  ? date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : String(value);
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickCount={3}
              domain={[0, 'auto']}
              tickFormatter={(value: number | bigint) => {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  notation: 'compact',
                  maximumFractionDigits: 0,
                }).format(value);
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="spending"
              type="natural"
              fill="url(#fillSpending)"
              stroke="var(--color-spending)"
              baseValue={0}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
