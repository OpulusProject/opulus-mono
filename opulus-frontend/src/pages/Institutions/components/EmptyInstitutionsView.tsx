import { Landmark } from 'lucide-react';
import React from 'react';

/**
 * Empty state rendered inside the institutions list when nothing is linked.
 * The page header owns the "Add institution" action.
 */
export const EmptyInstitutionsView: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
        <Landmark className="size-5" />
      </div>
      <p className="text-sm font-medium">No institutions linked yet</p>
      <p className="text-muted-foreground max-w-xs text-xs">
        Use Add institution to link a bank or credit card. Its accounts and
        transactions will show up in Opulus.
      </p>
    </div>
  );
};
