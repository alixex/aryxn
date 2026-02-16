# @aryxn/arweave

A simplified, tag-agnostic wrapper for the Arweave protocol. This package handles file uploads, transaction signing, and fee estimation, relying on the application layer to provide specific metadata tags.

## Features

- **Uploads**: Handles data transaction creation, signing, and posting to Arweave.
- **Compression**: Includes utilities to detect compressibility and estimate fees based on compressed size.
- **Fee Estimation**: Accurate fee calculation for both raw and compressed data.

## API Reference

| Function                               | Description                                                               |
| :------------------------------------- | :------------------------------------------------------------------------ |
| `uploadToArweave(data, key, tags)`     | Uploads data to Arweave with specified tags. Handles signing and posting. |
| `estimateArweaveFee(size)`             | Estimates the transaction fee (in Winston) for a given data size.         |
| `shouldCompressFile(file, threshold?)` | Determines if a file should be compressed based on size and type.         |
| `compressData(data)`                   | Compresses data using `fflate` (GZIP).                                    |
| `decompressData(data)`                 | Decompresses GZIP data.                                                   |

## Usage

```typescript
import { uploadToArweave, estimateArweaveFee } from "@aryxn/arweave"

// Estimate fee
const fee = await estimateArweaveFee(fileSize)

// Upload with custom tags
const txId = await uploadToArweave(data, walletKey, [
  { name: "Content-Type", value: "image/png" },
])
```
