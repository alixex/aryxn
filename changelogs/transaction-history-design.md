# Transaction History Redesign - Tech Spec

## Storage & Encryption Strategy (SQLite)

We will modify `packages/storage` or directly update the `apps/web/src/lib/store/bridge-history-repo.ts` to include encryption.
Since the SQLite vault relies on `@aryxn/crypto`, we can import utility functions for symmetric encryption.

**Core Changes:**

1.  **Schema Update**: No explicit alter table is needed if we store encrypted JSON in existing text fields (e.g., `amount`, `token`), but we should add a `user_address` column to support the address filter directly in SQL, or store `user_address` in a generic metadata column if schema migrations are hard. Ideally, we add `user_address` to `bridge_transactions` if we can.
2.  **Encryption/Decryption**: Wrap `upsertBridgeTransaction` to encrypt sensitive fields (amount, token, fromChain, toChain). Un-wrap in `listBridgeTransactions` to decrypt before yielding to the UI.

## Query Refactoring

Instead of pulling all `limit=100` and filtering in memory (via `Array.filter`):

1.  `listBridgeTransactions(params: { type?: string, address?: string, limit?: number })`
2.  SQL logic:
    ```sql
    SELECT * FROM bridge_transactions
    WHERE (? IS NULL OR type = ?)
      AND (? IS NULL OR user_address = ?)
    ORDER BY timestamp DESC
    LIMIT ?
    ```

## UI/UX Redesign

1.  **Filtering**:
    - Add a dropdown/selector at the top of `<TransactionHistory />` to filter by active wallet addresses.
    - Tabs: ALL, SWAP, SEND, RECEIVE.
2.  **Item Display**:
    - Redesign the individual transaction item using the `glass-premium` style.
    - Display source and destination chains clearly.
    - Show transaction status (Pending/Completed/Failed) more prominently.
