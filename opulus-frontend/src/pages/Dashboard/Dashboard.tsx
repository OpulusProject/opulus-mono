import { SectionCards, SpendingChart } from './components';

export default function Dashboard() {
  return (
    <>
      <SectionCards />
      <div className="px-4 lg:px-6">
        <SpendingChart />
      </div>
    </>
  );
}
