import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
} from '@/components/ui';
import { authClient } from '@/lib/auth/client';

interface DeleteAccountDialogProps {
  onClose: () => void;
}

/**
 * The confirmation for deleting the account. The password is the
 * re-authentication: the server refuses the request without it.
 */
export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  onClose,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await authClient.deleteUser({ password });
      if (deleteError) {
        setError(deleteError.message || 'Could not delete your account');
        setIsDeleting(false);
        return;
      }
      // The account and its session are gone: drop everything cached for it.
      queryClient.clear();
      void navigate({ to: '/login', replace: true });
    } catch {
      setError('Could not delete your account');
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your Opulus account, disconnects your
              banks and cards, and erases your accounts and transactions. You
              will be signed out. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="delete-account-password">
              Enter your password to confirm
            </FieldLabel>
            <Input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!password || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete everything'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
