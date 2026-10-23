# Choosing which accounts Opulus tracks

The user decides which of an institution's accounts Opulus links, when they first
connect it and any time afterwards. This is how that works, what Plaid has to be
set to, and what happens to data.

## Plaid Dashboard setting

Link's account selection screen on a **new** connection is controlled in the Plaid
Dashboard, not in code: *Link customization* → *Account Select* must be **Enabled
for multiple accounts**. Opulus stores whatever accounts Plaid returns for the
item (`/accounts/get`), so it follows that setting. (Some institutions, mostly
OAuth banks, ask for the accounts on their own consent screen.)

## Flows

| What the user does | What happens |
| --- | --- |
| Connects an institution | Link shows the selection screen; `createItem` stores the accounts Plaid returns |
| Connects an institution they already have | Link finishes, nothing is stored (one item per user and institution), and the app opens *Manage accounts* for that connection |
| **Manage accounts** (the connection's "..." menu, or "Add accounts" when Plaid flags new ones) | Link in update mode with `account_selection_enabled`; afterwards `POST /api/items/:id/update-accounts` reconciles |
| Stops sharing an account at the bank or in Plaid's portal | `ITEM` `USER_ACCOUNT_REVOKED` (a few institutions) removes that account |
| Opens an account at the bank | `ITEM` `NEW_ACCOUNTS_AVAILABLE` flags the connection; the user adds it through Manage accounts |

## What reconciling does (`syncItemAccounts`)

Plaid's `/accounts/get` is the list of accounts that are shared now:

- accounts we do not have are **added**; ones we have are **refreshed**;
- accounts we have that Plaid no longer reports are **removed**, with everything
  stored for them: transactions, holdings, investment transactions, liabilities
  and recurring streams all cascade from `account`. Securities and their prices
  are shared by everyone and stay.
- An account is matched by Plaid's account id and, failing that, by its persistent
  id (account ids can change across item updates), and a matched account keeps its
  data under its new id.
- **Nothing is deleted** when Plaid reports no accounts, or when none of the
  reported accounts is one of ours: both look like an error or every id changing,
  not a user de-selecting.

Only the user's own update-mode session and the explicit `USER_ACCOUNT_REVOKED`
webhook delete accounts. A sync response (for example the account list that comes
with `transactions/sync`) never does.

## An item with no accounts

If the last account goes (revoked at the bank, or closed), the connection is kept
and shows a red **No accounts** status with an **Add accounts** button, so it does
not look healthy and does not vanish. The status is derived by the API
(`errorCode` `NO_ACCOUNTS_SHARED`, never stored); a Plaid error on the item takes
precedence.

## Data

A removed account's data is deleted and not kept. The user is not asked to confirm
in the app: Plaid's own screen is the selection, and removed accounts being no
longer tracked or stored belongs in the data agreement.
