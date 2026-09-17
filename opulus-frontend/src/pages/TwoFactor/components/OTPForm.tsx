import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui';
import { authClient } from '@/lib/auth/client';

export function OTPForm() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      return;
    }

    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice: true,
      });

      if (error) {
        setError(error.message || 'Invalid verification code');
        setCode('');
        return;
      }

      void navigate({ to: '/dashboard', replace: true });
    } catch (err) {
      setError('An unexpected error occurred');
      setCode('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter verification code</CardTitle>
        <CardDescription>
          We sent a 6-digit code to your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="otp">Verification code</FieldLabel>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <FieldDescription>
                Enter the 6-digit code from your authenticator app.
              </FieldDescription>
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <FieldGroup>
              <Button
                type="submit"
                disabled={code.length !== 6}
                className="w-full"
              >
                Verify
              </Button>
              <FieldDescription className="text-center">
                Having trouble?{' '}
                <a href="#" className="underline underline-offset-4">
                  Use backup code
                </a>
              </FieldDescription>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
