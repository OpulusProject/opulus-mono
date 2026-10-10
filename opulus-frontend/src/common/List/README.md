# List

A family of parts for list pages (transactions, accounts, connections). Import
everything from `@/common/List`.

```tsx
<List aria-label="Transactions" isLoading={isLoading} isRefreshing={isPlaceholderData}>
  <ListGroup title="Today" trailingTitle="−$87.39">
    <ListRow ... />
  </ListGroup>
  <ListFooter summary="Showing 50 of 164" action={<Button>Load more</Button>} />
</List>
```

## Parts

| Part         | Use                                                                                  |
| ------------ | ------------------------------------------------------------------------------------ |
| `List`       | The container (`ul`). `isLoading` shows skeleton rows; `isRefreshing` dims the rows. |
| `ListGroup`  | A collapsible section: `title`, optional `trailingTitle`. Always collapsible.        |
| `ListHeader` | A header row: `title`, `trailingTitle`, `action`, `expanded`. Used by `ListGroup`.   |
| `ListRow`    | One item: icon or `logoUrl`, title, subtitle, trailing value.                        |
| `ListFooter` | `summary` text and an `action` (e.g. Load more).                                     |
| `ListEmpty`  | A row-shaped empty state: `icon`, `title`, `description?`, `action?`.                |
| `ListError`  | `ListEmpty` for a failed load: `subject`, `onRetry`.                                 |

## Rules

- **Parts must be direct children of `List`.** `List` wraps each child in an
  `li`, so a part inside a fragment is wrapped as one item. Pass an array (with
  `key`s) instead of a fragment.
- **To change a header's controls by its width, pass `action` a function**
  (`action={({ width }) => ...}`) rather than using container queries. Only the
  version you return is mounted, so a menu open in the one that goes away
  closes with it instead of jumping to the corner of the page.
- **Don't hand-roll empty or error states.** Use `ListEmpty` / `ListError`.
- **Empty logic with more than one case gets its own component** next to the
  page, e.g. `pages/Transactions/TransactionsEmpty.tsx`: it takes the facts
  (`query`, `connections`) and callbacks, and the page renders
  `<TransactionsEmpty ... />`. A list with a single empty case can use
  `ListEmpty` inline.
- Put a repeated row shape in the page as a `ListRow` wrapper
  (`TransactionRow`), not as new props on `ListRow`.
