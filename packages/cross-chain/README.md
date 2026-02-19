# @aryxn/cross-chain

Cross-chain bridge toolkit for Aryxn, built around Li.Fi routing/execution with status tracking, simulation, and recovery helpers.

## Installation

```bash
pnpm add @aryxn/cross-chain
```

## API Usage

This package is primarily consumed via `liFiBridgeService`, `BridgeStatusTracker`, `BridgeRecovery`, and simulation/address helpers.

### 1) Build route, estimate cost/risk

```typescript
import { liFiBridgeService, type BridgeRouteParams } from "@aryxn/cross-chain"

const params: BridgeRouteParams = {
  fromChain: 1,
  toChain: 137,
  fromToken: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  toToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  amount: "1000000",
  fromAddress: "0x...",
  toAddress: "0x...",
  priority: "balanced",
}

const route = await liFiBridgeService.getOptimalRoute(params)
const cost = liFiBridgeService.calculateCostBreakdown(route)
const risk = await liFiBridgeService.assessRisk(route)
```

### 2) Execute route with signer

```typescript
import { liFiBridgeService } from "@aryxn/cross-chain"
import type { Signer } from "ethers"

const txHash = await liFiBridgeService.executeBridgeTransaction(route, signer as Signer)
```

### 3) Check bridge status (manual refresh flow)

```typescript
import { BridgeStatusTracker } from "@aryxn/cross-chain"

if (BridgeStatusTracker.canRefresh(txHash)) {
  const info = await BridgeStatusTracker.checkStatus(txHash, fromChainId, toChainId)
  console.log(info.status, info.substatus)
}
```

### 4) Recovery flow (retry / claim guidance / speed up)

```typescript
import { BridgeRecovery } from "@aryxn/cross-chain"

const recoverable = await BridgeRecovery.isRecoverable(txHash, fromChainId, toChainId)
const rec = await BridgeRecovery.getRecommendations(
  txHash,
  fromChainId,
  toChainId,
  Date.now() - submittedAt,
)
```

### 5) Simulate route before execution

```typescript
import { simulateBridgeRoute } from "@aryxn/cross-chain"

const simulation = await simulateBridgeRoute(route)
if (simulation.status === "FAILED") {
  throw new Error(simulation.error || "Simulation failed")
}
```

### 6) Address & chain helpers

```typescript
import {
  validateAddress,
  getChainIdFromName,
  getAddressPlaceholder,
} from "@aryxn/cross-chain"

const chainId = getChainIdFromName("ethereum")
const isValid = chainId ? validateAddress("0x...", chainId) : false
```

## Exports

- `LiFiBridgeService`, `liFiBridgeService`
- `BridgeStatusTracker`
- `BridgeRecovery`
- `simulateBridgeRoute` and simulation helpers
- Address utilities (`validateAddress`, `getChainIdFromName`, etc.)
- Legacy `BridgeService` and `BridgeProvider`

## Notes

- This package depends on `@lifi/sdk` and signer-capable wallet integrations.
- For UI integrations, pair with persisted tx history/state management on the app side.
- `BridgeService.bridgeAsset` is a compatibility placeholder; use `liFiBridgeService` for production bridge flow.
