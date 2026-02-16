# @aryxn/arweave

A simplified, tag-agnostic wrapper for the Arweave protocol. This package handles file uploads, transaction signing, and fee estimation, relying on the application layer to provide specific metadata tags.

## Features

- **Uploads**: Handles data transaction creation, signing, and posting to Arweave.
- **Compression**: Includes utilities to detect compressibility and estimate fees based on compressed size.
- **Fee Estimation**: Accurate fee calculation for both raw and compressed data.
- **Search**: Provides Arweave GraphQL query capabilities for searching transactions by tags, content, and app names.

## API Reference

### Upload & Fee Management

| Function                               | Description                                                               |
| :------------------------------------- | :------------------------------------------------------------------------ |
| `uploadToArweave(data, key, tags)`     | Uploads data to Arweave with specified tags. Handles signing and posting. |
| `estimateArweaveFee(size)`             | Estimates the transaction fee (in Winston) for a given data size.         |
| `shouldCompressFile(file, threshold?)` | Determines if a file should be compressed based on size and type.         |
| `compressData(data)`                   | Compresses data using `fflate` (GZIP).                                    |
| `decompressData(data)`                 | Decompresses GZIP data.                                                   |

### Search & Query

| Function                           | Description                                    |
| :--------------------------------- | :--------------------------------------------- |
| `searchArweaveTransactionsNetwork` | Search transactions on Arweave by tags/content |
| `searchAppTransactions`            | Search transactions for a specific app         |

**Types:**

- `ArweaveSearchResult` - Transaction search result with metadata
- `SearchOptions` - Query options for search operations

## Usage

### Upload & Compression

```typescript
import { uploadToArweave, estimateArweaveFee } from "@aryxn/arweave"

// Estimate fee
const fee = await estimateArweaveFee(fileSize)

// Upload with custom tags
const txId = await uploadToArweave(data, walletKey, [
  { name: "Content-Type", value: "image/png" },
])
```

### Search Transactions

```typescript
import {
  searchArweaveTransactionsNetwork,
  searchAppTransactions,
} from "@aryxn/arweave"

// Search for specific app transactions
const arweaveResults = await searchAppTransactions("Aryxn", "filename", 50)

// Search Arweave network with strategies
const results = await searchArweaveTransactionsNetwork({
  query: "my-file",
  limit: 20,
  sort: "HEIGHT_DESC",
})

// Results include transaction details
results.forEach((tx) => {
  console.log(`TX: ${tx.id}`) // Transaction ID
  console.log(`Owner: ${tx.owner.address}`) // Uploader address
  console.log(`Tags: ${tx.tags.length}`) // Transaction metadata
  console.log(`Size: ${tx.data.size}`) // Data size in bytes
})
```

### Search Caching

Search results are cached by default to avoid repeated GraphQL queries:

```typescript
import {
  searchArweaveTransactionsNetwork,
  getSearchCache,
} from "@aryxn/arweave"

// Use cache (default behavior)
const results = await searchArweaveTransactionsNetwork({
  query: "my-file",
  cache: true, // Enable caching (default)
  cacheTtl: 5 * 60 * 1000, // 5 minutes
})

// Bypass cache for fresh results
const freshResults = await searchArweaveTransactionsNetwork({
  query: "my-file",
  cache: false,
})

// Inspect cache statistics
const cache = getSearchCache()
const stats = cache.getStats()
console.log(`Cache size: ${stats.size}/${stats.maxSize}`)

// Clear all cache
cache.clear()
```
