# Terminology

Opulus uses a few words for closely related things. They map to a small model:

```
Institution  ->  Connection (Item)  ->  Accounts  ->  Transactions
   the bank        a user's link          chequing,        individual
                   to that bank           credit card...   transactions
```

A user can have connections to many institutions, and each connection holds
several accounts.

## Glossary

| Term | Means | Where you will see it |
| ---- | ----- | --------------------- |
| **Institution** | The bank or card issuer itself (Chase, TD): its name, logo, and ID. Not something the user manages. | Plaid's institution catalog, `institutionId` / `institutionName` fields, `GET /api/institutions`, bank names on rows |
| **Item** | A user's live link to one institution. Plaid's term for it. | Prisma `Item`, `itemService`, `/api/items`, `useItems`, `ItemPublicDTO`, Plaid webhooks |
| **Connection** | The same thing as an item, in user-facing language. | UI copy, nav labels, page and component names (`Connections`, `ConnectionList`, `ConnectionRow`) |
| **Account** | One account inside a connection (chequing, credit card). | `BankAccount`, `/accounts`, `Account` DTO |

Item and connection are the same object. They differ only by layer.

## Rules

- **Data, API, and service layers say item.** Database models, services,
  endpoints, query hooks, DTOs, test and Bruno folders for the resource. This
  matches Plaid, so code, logs, and Plaid's docs line up.
- **UI says connection.** Anything a user reads or a page/component they land
  on: copy, nav labels, buttons ("Add connection"), headings, dialogs.
- **Say institution only for the bank itself.** When a string needs to name the
  bank, use the institution's name ("Disconnect Chase?"), or "institution" if
  the name is missing. A user links to an institution, but they manage a
  connection.
- **Never show "item" to users.** It is Plaid jargon.
- **Do not use "bank" as a type name.** Credit cards, brokerages, and fintech
  apps are institutions too.

## Plaid Link is a different "link"

`LaunchLink`, `LinkSession`, and `linkTokens` refer to Plaid Link, Plaid's
hosted UI for connecting an institution. They describe the flow, not the
resource. A successful Link flow creates a connection (item).

## Disconnecting

Disconnecting a connection permanently deletes its accounts and transactions
(see the delete item endpoint). Relinking later restores up to two years of
history from Plaid, subject to the institution's limits. There is no "disconnect
but keep history" state, which is why disconnect and delete are the same action.
