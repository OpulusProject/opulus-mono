import * as React from 'react';

import { AppLayout } from '@/common/AppLayout';

import { SettingsSidebar } from './components';

export const Settings: React.FC = () => {
  return (
    <AppLayout title="Settings">
      <div className="px-4 lg:px-6">
        <div className="flex gap-6">
          {/* Settings Navigation Sidebar */}
          <aside className="w-[240px] shrink-0">
            <SettingsSidebar />
          </aside>

          {/* Settings Content Area */}
          <div className="flex-1 min-w-0">
            {/* Settings content will go here */}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
