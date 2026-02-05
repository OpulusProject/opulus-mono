import * as React from 'react';

import { AppLayout } from '@/common/AppLayout';

export const Settings: React.FC = () => {
  return (
    <AppLayout title="Settings">
      <div className="px-4 lg:px-6">{/* Settings content will go here */}</div>
    </AppLayout>
  );
};
