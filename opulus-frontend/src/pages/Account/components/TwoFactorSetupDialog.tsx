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
  FieldDescription,
  FieldLabel,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui';
import { useSession } from '@/hooks/auth/useSession';
import { authClient } from '@/lib/auth/client';

interface TwoFactorSetupDialogProps {
  onClose: () => void;
}

interface Enrollment {
  /** otpauth:// link; opens in an authenticator app on the same device. */
  totpUri: string;
  /** The same secret as text, for typing into an authenticator app. */
  secret: string;
  backupCodes: string[];
}

type Step = 'password' | 'verify' | 'backup';

/**
 * Sets up two-factor authentication in three steps: confirm the password (which
 * starts enrollment), prove the authenticator app works by entering a code (which
 * is what turns two-factor on), then show the one-time backup codes.
 */
export const TwoFactorSetupDialog: React.FC<TwoFactorSetupDialogProps> = ({
  onClose,
}) => {
  const { refetch } = useSession();
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password,
      });
      if (enableError || !data) {
        setError(enableError?.message || 'Could not start two-factor setup');
        return;
      }
      setEnrollment({
        totpUri: data.totpURI,
        secret: new URL(data.totpURI).searchParams.get('secret') ?? '',
        backupCodes: data.backupCodes,
      });
      setPassword('');
      setStep('verify');
    } catch {
      setError('Could not start two-factor setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({
        code,
      });
      if (verifyError) {
        setError(verifyError.message || 'That code is not valid');
        setCode('');
        return;
      }
      refetch();
      setStep('backup');
    } catch {
      setError('Could not verify the code');
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        {step === 'password' && (
          <form onSubmit={handlePassword} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Set up two-factor authentication</DialogTitle>
              <DialogDescription>
                Enter your password to start. You&apos;ll need an authenticator
                app such as 1Password, Google Authenticator or Authy.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="setup-2fa-password">Password</FieldLabel>
              <Input
                id="setup-2fa-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <ErrorText message={error} />}
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
                {isSubmitting ? 'Checking...' : 'Continue'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'verify' && enrollment && (
          <form onSubmit={handleVerify} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Add Opulus to your app</DialogTitle>
              <DialogDescription>
                Add a new account in your authenticator app using this key, then
                enter the 6-digit code it shows.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel>Key</FieldLabel>
              <code className="bg-muted rounded-md px-3 py-2 font-mono text-sm break-all select-all">
                {enrollment.secret}
              </code>
              <FieldDescription>
                On a phone,{' '}
                <a
                  href={enrollment.totpUri}
                  className="underline underline-offset-4"
                >
                  open it in your authenticator app
                </a>{' '}
                instead.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-2fa-code">
                Verification code
              </FieldLabel>
              <InputOTP
                id="setup-2fa-code"
                maxLength={6}
                value={code}
                onChange={setCode}
              >
                <InputOTPGroup className="gap-1.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </Field>
            {error && <ErrorText message={error} />}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={code.length !== 6 || isSubmitting}
              >
                {isSubmitting ? 'Verifying...' : 'Turn on'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'backup' && enrollment && (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Two-factor authentication is on</DialogTitle>
              <DialogDescription>
                Save these backup codes somewhere safe. Each one can be used
                once if you lose access to your authenticator app. They
                won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>
            <ul className="bg-muted grid grid-cols-1 gap-2 rounded-md p-3 font-mono text-sm min-[400px]:grid-cols-2">
              {enrollment.backupCodes.map((backupCode) => (
                <li key={backupCode} className="break-all select-all">
                  {backupCode}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ErrorText: React.FC<{ message: string }> = ({ message }) => (
  <p role="alert" className="text-destructive text-sm">
    {message}
  </p>
);
