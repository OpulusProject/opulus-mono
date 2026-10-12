import { Page } from '@/common/Page';

export default function Dashboard() {
  return (
    <Page
      title="Overview"
      description="Where your money stands and where it went this month."
      requiresConnections={{
        title: 'No overview yet',
        description:
          'Connect an account to see your net worth, spending and recent activity.',
      }}
    />
  );
}
