import { Card, CardDescription, CardHeader, CardTitle } from '@gems';

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
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard description="Available Cash" value="$1,250.00" />
      <StatCard description="Spending This Month" value="$2,450.00" />
      <StatCard
        description="Largest Category This Month"
        value="Food & Dining"
      />
      <StatCard description="Credit Utilization" value="35%" />
    </div>
  );
}
