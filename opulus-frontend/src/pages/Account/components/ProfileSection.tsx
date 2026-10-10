import { Check } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Skeleton,
} from '@/components/ui';
import { useSession } from '@/hooks/auth/useSession';
import { authClient } from '@/lib/auth/client';

import { AccountSection } from './AccountSection';

export const ProfileSection: React.FC = () => {
  const { data: session, isPending, refetch } = useSession();
  // null until the user edits, so the field follows the session until then.
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const user = session?.user;
  const name = draft ?? user?.name ?? '';
  const trimmed = name.trim();
  const canSave = Boolean(user) && trimmed !== '' && trimmed !== user?.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { error: updateError } = await authClient.updateUser({
        name: trimmed,
      });
      if (updateError) {
        setError(updateError.message || 'Could not save your name');
        return;
      }
      refetch();
      // Keep showing the saved name until the refreshed session has it.
      setDraft(trimmed);
      setSaved(true);
    } catch {
      setError('Could not save your name');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AccountSection title="Profile" description="The name shown in the app.">
      {isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="account-name">Name</FieldLabel>
              <Input
                id="account-name"
                value={name}
                maxLength={100}
                autoComplete="name"
                onChange={(e) => {
                  setDraft(e.target.value);
                  setSaved(false);
                }}
              />
            </Field>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <p className="text-sm break-all">{user?.email}</p>
              <FieldDescription>
                You sign in with this address. It can&apos;t be changed here.
              </FieldDescription>
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canSave || isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
              {saved && (
                <span
                  role="status"
                  className="text-muted-foreground flex items-center gap-1 text-sm"
                >
                  <Check className="size-4" />
                  Saved
                </span>
              )}
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </div>
          </FieldGroup>
        </form>
      )}
    </AccountSection>
  );
};
