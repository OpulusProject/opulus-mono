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
} from '@gems';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { useVerifyTotp } from '@/hooks/auth/useTwoFactor';

interface OTPFormProps {
  onSuccess?: () => void;
}

export function OTPForm({ onSuccess }: OTPFormProps) {
  const [code, setCode] = useState('');
  const verifyTotpMutation = useVerifyTotp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      return;
    }

    verifyTotpMutation.mutate(
      { code, trustDevice: true },
      {
        onSuccess: async (response) => {
          console.log('2FA verified successfully:', response);
          // Invalidate and refetch session
          queryClient.invalidateQueries({ queryKey: ['session'] });
          await queryClient.refetchQueries({ queryKey: ['session'] });

          // Call onSuccess callback if provided, otherwise redirect to dashboard
          if (onSuccess) {
            onSuccess();
          } else {
            navigate({ to: '/dashboard', replace: true });
          }
        },
        onError: (error: any) => {
          console.error('2FA verification error:', error);
          // Reset code on error
          setCode('');
        },
      }
    );
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
            {verifyTotpMutation.isError && (
              <p className="text-sm text-destructive">
                {(verifyTotpMutation.error as any)?.response?.data?.message ||
                  'Invalid verification code'}
              </p>
            )}
            <FieldGroup>
              <Button
                type="submit"
                disabled={code.length !== 6 || verifyTotpMutation.isPending}
                className="w-full"
              >
                {verifyTotpMutation.isPending ? 'Verifying...' : 'Verify'}
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
