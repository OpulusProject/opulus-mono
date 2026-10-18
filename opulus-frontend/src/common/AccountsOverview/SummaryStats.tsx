import React from 'react';

export interface SummaryStat {
  label: string;
  value: string;
  detail?: string;
}

interface SummaryStatsProps {
  stats: SummaryStat[];
}

/** Row of headline numbers shown at the top of a page (three across, or four). */
export const SummaryStats: React.FC<SummaryStatsProps> = ({ stats }) => {
  return (
    <div
      className={
        stats.length === 4
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid gap-4 sm:grid-cols-3'
      }
    >
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-md border p-4">
          <div className="text-muted-foreground text-xs">{stat.label}</div>
          <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
            {stat.value}
          </div>
          {stat.detail && (
            <div className="text-muted-foreground mt-0.5 text-xs">
              {stat.detail}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
