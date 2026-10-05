import type { ItemPublicDTO } from '@opulus/core';
import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui';
import { getInstitutionLogo } from '@/utils/institution';

interface AccountsByInstitutionProps {
  items: ItemPublicDTO[];
}

export const AccountsByInstitution: React.FC<AccountsByInstitutionProps> = ({
  items,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <section key={item.id} className="rounded-md border">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Avatar className="size-7 shrink-0 rounded-[8px]">
              <AvatarImage
                src={getInstitutionLogo(item) ?? undefined}
                alt={item.institutionName || 'Institution'}
              />
              <AvatarFallback className="rounded-[8px] text-xs">
                {item.institutionName?.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-sm font-medium">
              {item.institutionName || 'Unknown Institution'}
            </h2>
          </div>
          {item.accounts.length === 0 ? (
            <p className="text-muted-foreground px-4 py-3 text-sm">
              No accounts found for this institution.
            </p>
          ) : (
            <ul className="divide-y">
              {item.accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="truncate text-sm">{account.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs capitalize">
                    {account.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
};
