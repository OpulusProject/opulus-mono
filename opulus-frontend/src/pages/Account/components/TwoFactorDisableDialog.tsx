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
import { useSession } from '@/hooks/auth/useSession';
import { authClient } from '@/lib/auth/client';

interface TwoFactorDisableDialogProps {
  onClose: () => void;
}

/** Turns two-factor authentication off after the user confirms their password. */
export const TwoFactorDisableDialog: React.FC<TwoFactorDisableDialogProps> = ({
  onClose,
}) => {
  const { refetch } = useSession();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: disableError } = await authClient.twoFactor.disable({
        password,
      });
      if (disableError) {
        setError(disableError.message || 'Could not turn off two-factor');
        return;
      }
      refetch();
      onClose();
    } catch {
      setError('Could not turn off two-factor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Turn off two-factor authentication?</DialogTitle>
            <DialogDescription>
              Your account will be protected by your password alone. Enter your
              password to confirm.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="disable-2fa-password">Password</FieldLabel>
            <Input
              id="disable-2fa-password"
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
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!password || isSubmitting}>
              {isSubmitting ? 'Turning off...' : 'Turn off'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
