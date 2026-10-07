import type { ItemDTO } from '@opulus/core/dto';
import { MoreHorizontal } from 'lucide-react';
import React, { useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import { useDeleteItem } from '@/hooks/items/useDeleteItem';
import type { UpdateMode } from '@/hooks/linkTokens/useLinkToken';
import { getItemStatus } from '@/utils/itemStatus';

interface ConnectionActionsProps {
  item: Pick<
    ItemDTO,
    'errorCode' | 'id' | 'institutionName' | 'newAccountsAvailable'
  >;
  onUpdate: (itemId: string, mode: UpdateMode) => void;
}

/**
 * A connection's actions: a button to repair it when it needs attention (or to
 * add newly found accounts when it doesn't), and the "..." menu with its
 * disconnect confirmation.
 */
export const ConnectionActions: React.FC<ConnectionActionsProps> = ({
  item,
  onUpdate,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const status = getItemStatus(item.errorCode);

  return (
    <>
      {/* Fixed width so the menu lines up whether or not a button shows. */}
      <div className="flex w-28 justify-end">
        {status.ctaLabel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUpdate(item.id, 'reconnect')}
          >
            {status.ctaLabel}
          </Button>
        ) : (
          item.newAccountsAvailable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onUpdate(item.id, 'add-accounts')}
            >
              Add accounts
            </Button>
          )
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`Actions for ${item.institutionName || 'this institution'}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DisconnectDialog
        item={item}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      />
    </>
  );
};

interface DisconnectDialogProps {
  item: Pick<ItemDTO, 'id' | 'institutionName'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Confirms, then disconnects a connection and deletes its data. */
const DisconnectDialog: React.FC<DisconnectDialogProps> = ({
  item,
  open,
  onOpenChange,
}) => {
  const { mutate: deleteItem, isPending: isDeleting } = useDeleteItem();
  const institutionName = item.institutionName || 'this institution';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isDeleting) onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!isDeleting}>
        <DialogHeader>
          <DialogTitle>Disconnect {institutionName}?</DialogTitle>
          <DialogDescription>
            Opulus will no longer track information for {institutionName}. All
            accounts and transactions for it will be permanently deleted. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={() => deleteItem({ itemId: item.id })}
          >
            {isDeleting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
