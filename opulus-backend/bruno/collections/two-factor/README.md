# Two-Factor Authentication API

Better Auth handles all 2FA endpoints automatically under `/api/auth/two-factor/*`.

## Endpoints

- **Enable 2FA** - Enable two-factor authentication (`POST /api/auth/two-factor/enable`)
- **Verify TOTP** - Verify TOTP code (`POST /api/auth/two-factor/verify-totp`)
- **Disable 2FA** - Disable two-factor authentication (`POST /api/auth/two-factor/disable`)

## Usage Flow

### Testing 2FA Setup

1. **Sign In** - Authenticate with email/password (from Auth collection)
2. **Enable 2FA** - Enable two-factor authentication
   - Save the `totpURI` from the response
   - Use a QR code generator or authenticator app to scan the URI
   - Save the `backupCodes` securely
3. **Sign Out** - Sign out to test the full flow
4. **Sign In** - Sign in again - you should get `twoFactorRedirect: true` in the response
5. **Verify TOTP** - Enter the 6-digit code from your authenticator app
   - If successful, you'll get a session and can access protected routes

## Notes

- Two-factor authentication can only be enabled for credential accounts (email/password)
- The `twoFactorEnabled` flag is set to `true` after successful TOTP verification
- Backup codes can be used to recover access if you lose your device
- Trusted devices skip 2FA for 30 days
