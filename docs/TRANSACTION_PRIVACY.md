# Transaction Privacy Implementation Plan

## Overview

This document outlines the approach for implementing transaction privacy in Opulus, ensuring that identifying transaction metadata (like merchant names) is encrypted at rest while remaining accessible to users when they log in.

## Problem Statement

Currently, transaction data is stored in plaintext in the database, including:
- `name` (merchant/transaction description)
- `merchantName`
- `location` (JSON with address, city, state, etc.)
- `paymentMeta` (JSON with payment details)
- `merchantEntityId`

This means anyone with database access can see identifying transaction information, even though users can only access their own transactions through the API.

## Recommended Approach: Field-Level Encryption with Server-Side Decryption

### Architecture Overview

**Flow:**
```
Plaid Webhook → Normalize Transaction → Encrypt Sensitive Fields → Store in DB (encrypted)
                                                                    ↓
User Requests Transactions ← Decrypt on Server ← Fetch from DB ← Authenticated Request
                                                                    ↓
                                                              HTTPS Response (decrypted)
```

### How It Works

1. **Encryption (on write):**
   - When transactions are synced from Plaid, sensitive fields are encrypted before storing
   - Uses user-specific encryption keys (derived from master key + userId)
   - Uses AES-256-GCM for authenticated encryption

2. **Decryption (on read):**
   - When authenticated users request their transactions, the server decrypts sensitive fields
   - Decryption happens server-side before sending the response
   - Decrypted data is sent over HTTPS to the client

3. **Security Layers:**
   ```
   ┌─────────────────────────────────────────┐
   │ Layer 1: Authentication (Better Auth)   │ ← Only authenticated users can request
   ├─────────────────────────────────────────┤
   │ Layer 2: Authorization (User ID check)  │ ← Users can only see their own data
   ├─────────────────────────────────────────┤
   │ Layer 3: Field-level Encryption (DB)    │ ← Protects against DB breaches
   ├─────────────────────────────────────────┤
   │ Layer 4: HTTPS/TLS (Network)            │ ← Protects network traffic
   └─────────────────────────────────────────┘
   ```

### Why Server-Side Decryption?

**Pros:**
- ✅ Simpler architecture (no client-side key management)
- ✅ Better user experience (users don't manage keys)
- ✅ Works with any client (web, mobile, API)
- ✅ Standard industry practice (Mint, Credit Karma, banking apps)
- ✅ HTTPS already protects network traffic

**Security Note:**
- The HTTPS response contains decrypted data, but HTTPS encrypts the connection
- The main threat model is database breaches, not network interception
- If an attacker intercepts HTTPS traffic, you have bigger problems (compromised client, MITM, etc.)

## What to Encrypt

### High Priority (Encrypt These)
- `merchantName` - Directly identifies merchants
- `name` - Transaction description (if it contains merchant info)
- `location` - Address, city, state (identifying location data)
- `paymentMeta` - Payment details (reference numbers, etc.)

### Lower Priority (Can Stay Unencrypted)
- `amount` - Needed for analytics and calculations
- `date` - Needed for time-based queries
- `category` / `categoryId` - Useful for analytics (less identifying)
- `pending` - Status flag
- `isoCurrencyCode` - Currency information

## Implementation Details

### 1. Encryption Service

Create a dedicated encryption service that handles:
- User-specific encryption keys (derived from master key + userId)
- AES-256-GCM encryption/decryption
- Key rotation support
- Error handling for corrupted data

**Key Derivation:**
```
userKey = HKDF(masterKey, userId, "opulus-transaction-encryption")
```

**Encryption Algorithm:**
- AES-256-GCM (authenticated encryption)
- Includes nonce/IV for each encryption
- Provides integrity checking

### 2. Database Schema Changes

**Option A: Add Encrypted Columns**
- Add new encrypted columns: `nameEncrypted`, `merchantNameEncrypted`, `locationEncrypted`, `paymentMetaEncrypted`
- Keep original columns for backward compatibility during migration
- Gradually migrate data and remove old columns

**Option B: Single Encrypted JSON Blob**
- Add `sensitiveDataEncrypted` column
- Store all sensitive fields as encrypted JSON
- Simpler schema, but harder to query individual fields

**Recommended: Option A** for better query flexibility

### 3. Service Layer Changes

**Transaction Service:**
- `create()` / `createMany()` - Encrypt sensitive fields before saving
- `getAllByUserId()` - Decrypt sensitive fields when fetching for authenticated users
- Ensure decryption only happens for data owner (userId check)

**Middleware:**
- Ensure all transaction endpoints verify user ownership
- Add audit logging (without sensitive data)

### 4. Key Management

**Master Key Storage:**
- Store master encryption key in environment variables
- Or use AWS KMS / Azure Key Vault / Google Cloud KMS
- Never commit keys to code repository
- Rotate keys periodically

**Per-User Key Derivation:**
- Derive user-specific keys from master key + userId
- Keys are deterministic (same userId = same key)
- No need to store per-user keys separately

**Key Rotation:**
- Plan for key rotation strategy
- May need to re-encrypt existing data with new keys
- Consider versioning encrypted data

## Security Considerations

### Additional Privacy Measures

1. **Access Logs:**
   - Don't log full transaction details
   - Log only transaction IDs and user IDs
   - Avoid logging merchant names in application logs

2. **Analytics:**
   - Aggregate on non-sensitive fields only
   - Use differential privacy if needed
   - Don't store raw transaction data in analytics DBs

3. **Backups:**
   - Encrypt database backups
   - Secure backup encryption keys separately
   - Test restore procedures

4. **Compliance:**
   - Consider GDPR (right to deletion)
   - Consider PCI-DSS if handling payment data
   - Document encryption practices for audits

## How Other Services Handle This

### Mint / Credit Karma
- Stores transaction data encrypted at rest
- Uses field-level encryption for sensitive fields
- Decrypts server-side for authenticated users
- Aggregates on non-sensitive fields for insights

### YNAB (You Need A Budget)
- Offers client-side encryption option
- Users manage their own encryption keys
- Trade-off: lost keys = lost data

### Personal Capital / Empower
- Encrypted storage with user-specific keys
- Decrypts only for authenticated sessions
- Uses envelope encryption (data keys encrypted by master keys)

### Banking Apps
- Most use database-level encryption (TDE)
- Some use application-level encryption for sensitive fields
- Compliance-driven (PCI-DSS, SOC 2)

### Plaid (Our Provider)
- Plaid stores transaction data encrypted
- Access tokens are encrypted
- They use field-level encryption for sensitive data
- We receive decrypted data via API, then we encrypt it

## Alternative Approaches (Not Recommended)

### Tokenization
- Replace merchant names with tokens
- Separate encrypted mapping table
- More complex, less flexible than encryption

### Client-Side Encryption
- Encrypt on client before sending to API
- Backend never sees plaintext
- Complex key management, lost keys = lost data
- Can't do server-side processing/analytics

## Questions to Consider

Before implementation, consider:

1. **Search/Filter Requirements:**
   - Do you need to search/filter by merchant name?
   - If yes, may need tokenization or hashing approach
   - If no, full encryption is fine

2. **Analytics Requirements:**
   - Do you need analytics on merchant data?
   - May need tokenization or hashing for aggregation
   - Or separate analytics pipeline with anonymized data

3. **Compliance Requirements:**
   - GDPR, SOC 2, PCI-DSS?
   - Affects encryption standards and documentation

4. **Key Rotation Strategy:**
   - How often to rotate keys?
   - How to handle re-encryption of existing data?
   - Versioning strategy for encrypted data

5. **Cross-User Analytics:**
   - Do you need aggregated merchant spending across users?
   - May need hashed merchant names for deduplication
   - Or separate analytics pipeline

## Implementation Checklist

- [ ] Design encryption service architecture
- [ ] Choose key management solution (env vars vs KMS)
- [ ] Implement encryption/decryption functions
- [ ] Update database schema (add encrypted columns)
- [ ] Update transaction service (encrypt on write, decrypt on read)
- [ ] Add user ownership verification middleware
- [ ] Create migration script for existing data
- [ ] Update API responses (ensure decryption)
- [ ] Add audit logging (without sensitive data)
- [ ] Update documentation
- [ ] Test encryption/decryption flows
- [ ] Test key rotation process
- [ ] Security review
- [ ] Performance testing (encryption overhead)

## Performance Considerations

- Encryption/decryption adds CPU overhead
- Consider caching decrypted data for active sessions
- Batch encryption operations when possible
- Monitor performance impact on transaction sync

## Future Enhancements

- Key rotation automation
- Encrypted search capabilities (if needed)
- Analytics pipeline with anonymized data
- Compliance reporting tools
- Audit trail for encryption operations

## User Communication & Trust Building

### The Trust Problem

Users need to trust that:
1. We're actually encrypting their data (not just saying we are)
2. We're following security best practices
3. Their data is protected even if our database is breached
4. We're transparent about what we do and don't do

**Challenge:** Users can't directly verify encryption - they have to trust us. So we need to build trust through transparency, proof, and clear communication.

### Communication Strategy

#### 1. Privacy Policy & Terms of Service

**Where:** Legal documents (linked from login, footer, settings)

**What to Include:**
- **Data Encryption:** "We encrypt sensitive transaction data (merchant names, locations) using AES-256-GCM encryption at rest"
- **What's Encrypted:** Explicitly list what fields are encrypted vs. unencrypted
- **Access Control:** "Only you can access your transaction data through authenticated sessions"
- **Data Sharing:** "We never sell your transaction data" / "We only share with Plaid for transaction syncing"
- **Breach Notification:** "In the event of a data breach, we will notify affected users within 72 hours"
- **Data Retention:** How long data is kept, deletion policies

**Example Language:**
```
Transaction Privacy:
- Merchant names and locations are encrypted using AES-256-GCM encryption
- Encryption keys are user-specific and derived securely
- Data is encrypted at rest in our database
- Only you can decrypt your transaction data when logged in
- We use HTTPS/TLS for all network communication
```

#### 2. In-App Security Page

**Where:** Settings → Security & Privacy (new page)

**What to Show:**
- **Security Status Badge:** "Your data is encrypted" with green checkmark
- **What's Protected:** Visual list of encrypted fields
- **Last Security Audit:** "Last verified: [date]" (if you do audits)
- **Security Features:** 
  - ✅ Field-level encryption (AES-256-GCM)
  - ✅ HTTPS/TLS encryption
  - ✅ Two-factor authentication available
  - ✅ User-specific encryption keys
- **Data Access:** "Only you can access your transaction data"
- **Link to:** Full privacy policy, security documentation

**UI Components:**
```
┌─────────────────────────────────────────┐
│ Security & Privacy                      │
├─────────────────────────────────────────┤
│ 🔒 Your Data is Encrypted               │
│                                         │
│ We protect your sensitive transaction   │
│ data with industry-standard encryption. │
│                                         │
│ ✅ Merchant names encrypted             │
│ ✅ Transaction locations encrypted      │
│ ✅ Payment metadata encrypted           │
│ ✅ HTTPS/TLS network encryption         │
│ ✅ Two-factor authentication available  │
│                                         │
│ [Learn More] [Privacy Policy]           │
└─────────────────────────────────────────┘
```

#### 3. Onboarding / First-Time User Experience

**When:** After connecting first bank account

**Message:**
```
🔒 Your Transaction Privacy

We encrypt sensitive transaction data to protect your privacy:
• Merchant names are encrypted at rest
• Only you can see your transaction details when logged in
• We use bank-level security standards

[Learn More] [Continue]
```

#### 4. Transaction List Indicators

**Where:** Transaction list/page

**Visual Cue:** Small lock icon next to sensitive fields
- Shows that merchant names are encrypted
- Tooltip: "This data is encrypted at rest"

**Example:**
```
Transaction List:
- 🔒 STARBUCKS COFFEE #1234    -$5.50
- 🔒 AMAZON.COM                -$29.99
- 🔒 SHELL GAS STATION         -$45.00
```

#### 5. Security Documentation Page

**Where:** Public page (e.g., `/security` or `/privacy/security`)

**What to Include:**
- **Technical Details:** Encryption algorithms, key management
- **Security Architecture:** How data flows through the system
- **Compliance:** SOC 2, GDPR, etc. (if applicable)
- **Third-Party Audits:** Security audit reports (if available)
- **Bug Bounty Program:** If you have one
- **Security Contact:** security@opulus.app

**Example Structure:**
```
# Security at Opulus

## Data Encryption
- Algorithm: AES-256-GCM
- Key Management: User-specific keys derived from master key
- Encryption at Rest: Yes, for sensitive transaction fields
- Encryption in Transit: HTTPS/TLS 1.3

## What We Encrypt
- Merchant names
- Transaction locations
- Payment metadata

## What We Don't Encrypt (for functionality)
- Transaction amounts (needed for calculations)
- Transaction dates (needed for time-based queries)
- Categories (needed for analytics)

## Access Control
- Multi-factor authentication available
- Session-based access only
- Users can only access their own data

## Compliance
- [SOC 2 Type II] (if applicable)
- [GDPR Compliant] (if applicable)
- [PCI-DSS] (if handling payments)

## Security Audits
- Last audit: [Date]
- Auditor: [Company Name]
- Report: [Link if public]

## Reporting Security Issues
Email: security@opulus.app
```

### Building Trust: Proof & Verification

#### 1. Security Audits & Certifications

**SOC 2 Type II:**
- Third-party audit of security controls
- Shows you follow security best practices
- Can be expensive ($20k-$50k+) but builds significant trust
- Display badge: "SOC 2 Type II Certified"

**Penetration Testing:**
- Regular security audits by third-party firms
- Shows you're proactive about security
- Can share summary reports (redacted)

**Bug Bounty Program:**
- HackerOne, Bugcrowd, or self-hosted
- Shows you're open to security feedback
- Rewards researchers for finding vulnerabilities

#### 2. Transparency Reports

**What to Share:**
- Number of security incidents (even if zero)
- Data breach history (transparency builds trust)
- Government data requests (if applicable)
- Security improvements made over time

**Example:**
```
Security Transparency Report - 2024
- Security incidents: 0
- Data breaches: 0
- Security improvements: 12
- Penetration tests: 2
- Bug bounty reports resolved: 5
```

#### 3. Open Source Security Tools

**If Applicable:**
- Open source encryption libraries you use
- Security tooling that's publicly auditable
- Shows you're using well-vetted code

**Example:**
"We use industry-standard encryption libraries that are open source and regularly audited by the security community."

#### 4. Technical Proof (For Advanced Users)

**For Developers/Technical Users:**
- API documentation showing encryption headers
- Security whitepaper (technical deep dive)
- GitHub security advisories
- Security.txt file (RFC 9116)

**Security.txt Example** (`/.well-known/security.txt`):
```
Contact: mailto:security@opulus.app
Expires: 2025-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://opulus.app/.well-known/security.txt
```

### What Other Companies Do

#### Mint / Credit Karma
- **Privacy Policy:** Detailed encryption section
- **Security Page:** Public security documentation
- **In-App:** Security badges and indicators
- **Trust Signals:** "Bank-level security" messaging

#### YNAB
- **Blog Posts:** Detailed technical blog posts about security
- **Transparency:** Open about security practices
- **User Education:** Explains encryption to users in plain language

#### Banking Apps
- **Regulatory Compliance:** Display compliance badges (FDIC, etc.)
- **Security Guarantees:** "We'll cover losses if your account is compromised"
- **Regular Audits:** Annual security audits

#### 1Password / Bitwarden
- **Security Audits:** Public security audit reports
- **Bug Bounties:** Active bug bounty programs
- **White Papers:** Detailed security architecture documents
- **Transparency:** Very open about security practices

### Messaging Guidelines

#### Do's ✅
- **Be Specific:** "AES-256-GCM encryption" not just "encryption"
- **Be Honest:** Acknowledge what you don't encrypt and why
- **Use Plain Language:** Explain technical terms
- **Show, Don't Just Tell:** Visual indicators, badges, icons
- **Regular Updates:** Update security page when you improve security

#### Don'ts ❌
- **Don't Overpromise:** Don't claim "military-grade" or "unbreakable"
- **Don't Hide Limitations:** Be transparent about what's encrypted vs. not
- **Don't Use Jargon:** Avoid technical terms without explanation
- **Don't Set and Forget:** Keep security documentation updated

### Implementation Checklist

**Documentation:**
- [ ] Update Privacy Policy with encryption details
- [ ] Create Security & Privacy page in Settings
- [ ] Create public Security documentation page (`/security`)
- [ ] Add security indicators to transaction list
- [ ] Add security messaging to onboarding flow

**Trust Building:**
- [ ] Consider SOC 2 audit (if budget allows)
- [ ] Set up bug bounty program (or security contact)
- [ ] Create security.txt file
- [ ] Plan regular security audits
- [ ] Create transparency report template

**UI/UX:**
- [ ] Add security badge/indicator in Settings
- [ ] Add lock icons to encrypted fields in transaction list
- [ ] Add tooltips explaining encryption
- [ ] Create "Learn More" links to detailed docs
- [ ] Add security messaging to login/signup pages

**Communication:**
- [ ] Write blog post about security approach
- [ ] Create email template for security updates
- [ ] Plan communication for security improvements
- [ ] Prepare breach notification template (hope you never need it)

### Example User-Facing Messages

#### Short Version (Tooltip/Indicator):
"🔒 Encrypted - Your merchant names are encrypted at rest using AES-256-GCM encryption. Only you can see this data when logged in."

#### Medium Version (Settings Page):
"**Transaction Privacy**
We encrypt sensitive transaction data to protect your privacy. Merchant names, locations, and payment metadata are encrypted using AES-256-GCM encryption. Only you can decrypt and view this data when you're logged in. [Learn More]"

#### Long Version (Security Page):
"**How We Protect Your Transaction Data**

At Opulus, we take your privacy seriously. We use industry-standard encryption to protect your sensitive transaction data:

**Encryption at Rest:** Merchant names, transaction locations, and payment metadata are encrypted using AES-256-GCM encryption before being stored in our database. Each user has a unique encryption key, so even if our database is compromised, your data remains protected.

**Encryption in Transit:** All data is transmitted over HTTPS/TLS 1.3 encrypted connections.

**Access Control:** Only you can access your transaction data through authenticated sessions. We use multi-factor authentication to add an extra layer of security.

**What We Don't Encrypt:** Transaction amounts, dates, and categories remain unencrypted so we can provide you with financial insights and analytics. These fields are less identifying and necessary for core functionality.

[Read our full Privacy Policy] [Contact Security Team]"

---

**Status:** Planning Phase  
**Last Updated:** 2025-01-XX  
**Next Steps:** Design encryption service architecture and key management strategy

