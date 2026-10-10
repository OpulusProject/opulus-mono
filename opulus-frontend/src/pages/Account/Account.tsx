import { PageHeader } from '@/common/PageHeader';

import {
  DeleteAccountSection,
  ProfileSection,
  TwoFactorSection,
} from './components';

export const Account: React.FC = () => (
  <div className="flex flex-col gap-6 px-4 lg:px-6">
    <PageHeader
      title="Your account"
      description="Manage your profile, how you sign in, and your data."
    />

    <div className="flex max-w-2xl flex-col gap-6">
      <ProfileSection />
      <TwoFactorSection />
      <DeleteAccountSection />
    </div>
  </div>
);
