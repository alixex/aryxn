# Cross-Chain Bridge Implementation Design

**Date**: 2026-02-18  
**Status**: Design Phase  
**Priority**: High  
**Estimated Timeline**: 2-3 weeks

## Executive Summary

Implement a production-ready cross-chain bridge feature using Li.Fi aggregator as the primary routing engine, with optimized pathways for specific scenarios to balance cost, speed, and security.

## Background

### Current State

- BridgeCard UI exists but uses mock implementation
- `@aryxn/cross-chain` package is a placeholder
- No real cross-chain functionality

### Problems

- Users cannot transfer assets between different chains (e.g., ETH → SOL)
- Missing destination address input
- No integration with actual bridge protocols

### Goals

- Enable seamless cross-chain asset transfers
- Optimize for both cost and speed
- Maintain high security standards
- Provide excellent user experience

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      BridgeCard (UI Layer)                  │
│  - Chain selectors (From/To)                                │
│  - Token selector with balance display                      │
│  - Destination address input (auto-fill + validation)       │
│  - Route preview (steps, fees, time estimate)               │
│  - Priority selector (Fastest/Balanced/Cheapest)            │
│  - Risk warnings (for large amounts)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              useBridge Hook (Business Logic)                │
│  - getQuote(): Fetch optimal route with debouncing          │
│  - executeBridge(): Execute cross-chain transaction         │
│  - trackStatus(): Poll transaction status                   │
│  - recoverFailed(): Handle failed transactions              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         LiFiBridgeService (@aryxn/cross-chain)              │
│                                                             │
│  Smart Router:                                              │
│  ├─ Small amounts (< $1K): Li.Fi default                   │
│  ├─ USDC transfers: Circle CCTP (cheapest)                 │
│  ├─ EVM ↔ EVM urgent: Across Protocol (fastest)            │
│  ├─ ETH ↔ SOL: Wormhole direct (reliable)                  │
│  └─ Large amounts (> $10K): Batch splitting                │
│                                                             │
│  Security Features:                                         │
│  ├─ Amount-based risk warnings                             │
│  ├─ Address format validation                              │
│  ├─ Transaction simulation (dry-run)                       │
│  └─ Automatic retry with exponential backoff               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                         │
│  ├─ Li.Fi SDK (primary aggregator)                         │
│  ├─ Across Protocol SDK (fast path optimization)           │
│  ├─ Circle CCTP SDK (USDC optimization)                    │
│  └─ Wormhole SDK (Solana optimization)                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input → Validation → Quote Fetching → Route Selection → Execution → Status Tracking
     │            │              │                │               │            │
     │            │              │                │               │            ▼
     │            │              │                │               │      SQLite Storage
     │            │              │                │               │      (Transaction History)
     │            │              │                │               │
     │            │              │                │               ▼
     │            │              │                │      Wallet Signing (Ethers/Anchor)
     │            │              │                │
     │            │              │                ▼
     │            │              │      Smart Router Decision Tree
     │            │              │
     │            │              ▼
     │            │      Li.Fi API / Direct Protocol APIs
     │            │
     │            ▼
     │      Address Format Validation
     │      (Ethereum: 0x..., Solana: base58)
     │
     ▼
Amount/Chain/Token Selection
```

## Implementation Details

### 1. Package Dependencies

```json
{
  "dependencies": {
    "@lifi/sdk": "^3.0.0",
    "@lifi/widget": "^3.0.0",
    "@across-protocol/sdk": "^2.0.0",
    "@circlefin/cctp-sdk": "^1.0.0",
    "@certusone/wormhole-sdk": "^0.10.0"
  }
}
```

### 2. Core Service Implementation

**File**: `packages/cross-chain/src/lifi-bridge-service.ts`

```typescript
import { LiFi, RoutesRequest, Route } from "@lifi/sdk"

export class LiFiBridgeService {
  private lifi: LiFi

  constructor() {
    this.lifi = new LiFi({
      integrator: "aryxn",
    })
  }

  /**
   * Get optimized route based on amount and priority
   */
  async getOptimalRoute(params: {
    fromChain: string
    toChain: string
    fromToken: string
    toToken: string
    amount: string
    fromAddress: string
    toAddress: string
    priority: "fastest" | "balanced" | "cheapest"
  }): Promise<Route> {
    // Smart routing logic
    const amountUSD = await this.convertToUSD(params.amount, params.fromToken)

    // Strategy 1: USDC optimization
    if (params.fromToken === "USDC" && params.toToken === "USDC") {
      return await this.useCCTP(params)
    }

    // Strategy 2: Fast path for EVM chains
    if (
      this.isEVM(params.fromChain) &&
      this.isEVM(params.toChain) &&
      params.priority === "fastest"
    ) {
      return await this.useAcross(params)
    }

    // Strategy 3: Solana optimized path
    if (params.fromChain === "solana" || params.toChain === "solana") {
      return await this.useWormhole(params)
    }

    // Default: Li.Fi aggregator
    return await this.useLiFi(params)
  }

  /**
   * Execute bridge transaction
   */
  async executeBridge(route: Route, signer: any): Promise<string> {
    // Implementation details...
  }
}
```

### 3. UI Components

**Key Features**:

1. **Destination Address Input**

```tsx
<div className="space-y-2">
  <Label>Destination Address</Label>
  <Input
    value={destAddress}
    onChange={handleAddressChange}
    placeholder={getAddressPlaceholder(destChain)}
  />
  {hasAccountOnDestChain && (
    <Button size="sm" onClick={fillMyAddress}>
      Use My {destChain} Address
    </Button>
  )}
  {addressError && <Alert variant="destructive">{addressError}</Alert>}
</div>
```

2. **Priority Selector**

```tsx
<Tabs value={priority} onValueChange={setPriority}>
  <TabsList>
    <TabsTrigger value="fastest">⚡ Fastest (~5 min)</TabsTrigger>
    <TabsTrigger value="balanced">⚖️ Balanced (~15 min)</TabsTrigger>
    <TabsTrigger value="cheapest">💰 Cheapest (~30 min)</TabsTrigger>
  </TabsList>
</Tabs>
```

3. **Route Visualization**

```tsx
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <ChainIcon chain={route.steps[0].source} />
    {route.steps.map((step, i) => (
      <>
        <ArrowRight />
        <ChainIcon chain={step.destination} />
      </>
    ))}
  </div>
  <div className="text-muted-foreground text-sm">
    Via {route.steps.map((s) => s.toolDetails.name).join(" → ")}
  </div>
</div>
```

4. **Risk Warning (Large Amounts)**

```tsx
{
  amountUSD > 10000 && (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Large Amount Detected</AlertTitle>
      <AlertDescription>
        Consider splitting into multiple transactions for safety.
        <Button onClick={enableBatchMode}>Enable Batch Mode</Button>
      </AlertDescription>
    </Alert>
  )
}
```

### 4. Transaction Status Tracking

```typescript
async function trackBridgeTransaction(txHash: string) {
  const pollInterval = 10000 // 10 seconds

  const interval = setInterval(async () => {
    const status = await lifi.getStatus({
      txHash,
      bridge: "wormhole",
    })

    // Update local storage
    await db.updateTransaction(txHash, {
      status: status.status,
      substatus: status.substatus,
      // destination tx hash becomes available after completion
      destTxHash: status.receiving?.txHash,
    })

    if (status.status === "DONE" || status.status === "FAILED") {
      clearInterval(interval)
    }
  }, pollInterval)
}
```

## Security Measures

### 1. Amount-Based Risk Management

```typescript
const RISK_THRESHOLDS = {
  LOW: 1000, // < $1K: No warning
  MEDIUM: 10000, // $1K-10K: Suggest batch
  HIGH: 100000, // > $100K: Require batch or CEX
}

function assessRisk(amountUSD: number): RiskLevel {
  if (amountUSD < RISK_THRESHOLDS.LOW) return "LOW"
  if (amountUSD < RISK_THRESHOLDS.MEDIUM) return "MEDIUM"
  return "HIGH"
}
```

### 2. Address Validation

```typescript
function validateAddress(address: string, chain: string): boolean {
  switch (chain) {
    case "ethereum":
    case "polygon":
    case "arbitrum":
      return /^0x[a-fA-F0-9]{40}$/.test(address)
    case "solana":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
    case "bitcoin":
      return (
        /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
        /^bc1[a-z0-9]{39,59}$/.test(address)
      )
    default:
      return false
  }
}
```

### 3. Batch Splitting Logic

```typescript
async function createBatchTransactions(
  totalAmount: string,
  batchSize: number = 3,
): Promise<Transaction[]> {
  const perBatch = BigInt(totalAmount) / BigInt(batchSize)
  const transactions: Transaction[] = []

  for (let i = 0; i < batchSize; i++) {
    transactions.push({
      amount: perBatch.toString(),
      delay: i * 60000, // 1 minute between batches
    })
  }

  return transactions
}
```

## Cost Optimization Strategy

### Route Selection Matrix

| From Chain | To Chain | Token | Amount | Optimal Route | Est. Fee      | Est. Time |
| ---------- | -------- | ----- | ------ | ------------- | ------------- | --------- |
| Ethereum   | Polygon  | USDC  | Any    | Circle CCTP   | $1 (gas only) | 15-20 min |
| Ethereum   | Polygon  | ETH   | < $1K  | Li.Fi Auto    | $3-5          | 10-15 min |
| Ethereum   | Polygon  | ETH   | > $1K  | Across        | $5-8          | 2-5 min   |
| Ethereum   | Solana   | Any   | Any    | Wormhole      | $3-8          | 15-20 min |
| Polygon    | Arbitrum | Any   | < $5K  | Stargate      | $1-3          | 5-10 min  |
| Polygon    | Arbitrum | Any   | > $5K  | Across        | $2-5          | 2-5 min   |

### Dynamic Fee Calculation

```typescript
async function estimateTotalCost(route: Route): Promise<CostBreakdown> {
  return {
    gasCost: route.steps.reduce((sum, step) => sum + step.estimate.gasCosts, 0),
    protocolFees: route.steps.reduce((sum, step) => sum + step.estimate.feeCosts, 0),
    priceImpact: route.steps.reduce((sum, step) => sum + (step.estimate.slippage || 0), 0),
    total: /* sum of above */,
    savings: /* compared to default route */
  }
}
```

## Error Handling & Recovery

### 1. Transaction Failures

```typescript
enum BridgeErrorType {
  INSUFFICIENT_LIQUIDITY = "INSUFFICIENT_LIQUIDITY",
  SLIPPAGE_EXCEEDED = "SLIPPAGE_EXCEEDED",
  DESTINATION_UNREACHABLE = "DESTINATION_UNREACHABLE",
  TIMEOUT = "TIMEOUT",
}

async function handleBridgeError(error: BridgeError) {
  switch (error.type) {
    case BridgeErrorType.INSUFFICIENT_LIQUIDITY:
      // Suggest alternative route
      return suggestAlternativeRoute()

    case BridgeErrorType.TIMEOUT:
      // Check if transaction is stuck
      const status = await checkTransactionStatus()
      if (status === "PENDING") {
        return retryStatusCheck()
      }
      break

    // ... other cases
  }
}
```

### 2. Stuck Transaction Recovery

```typescript
async function recoverStuckTransaction(txHash: string) {
  // 1. Query bridge status
  const status = await lifi.getStatus({ txHash })

  // 2. If stuck on source chain, speed up with higher gas
  if (status.substatus === "PENDING_IN_WALLET") {
    return await speedUpTransaction(txHash)
  }

  // 3. If stuck on destination, trigger manual claim
  if (status.substatus === "READY_FOR_CLAIMING") {
    return await manualClaim(txHash)
  }
}
```

## Testing Strategy

### 1. Unit Tests

- Address validation for all supported chains
- Amount conversion and fee calculation
- Route selection logic
- Error handling for all failure modes

### 2. Integration Tests

- Li.Fi API integration (testnet)
- Transaction status polling
- SQLite storage operations

### 3. E2E Tests (Testnet Only)

- Complete bridge flow: ETH → Polygon
- USDC transfer via CCTP
- Failed transaction recovery
- Batch transaction execution

### 4. Manual Testing Checklist

- [ ] Small amount bridge (< $100 testnet tokens)
- [ ] Address auto-fill from user accounts
- [ ] Invalid address rejection
- [ ] Quote refresh on input change
- [ ] Transaction status updates in history
- [ ] Error message clarity

## Monitoring & Analytics

### Metrics to Track

```typescript
interface BridgeMetrics {
  totalVolume: number
  transactionCount: number
  successRate: number
  averageTime: number
  averageFee: number
  popularRoutes: Array<{ from: string; to: string; count: number }>
  failureReasons: Map<BridgeErrorType, number>
}
```

### User Notifications

```typescript
// Success
toast.success("Bridge Complete!", {
  description: `${amount} ${token} arrived on ${destChain}`,
  action: {
    label: "View Transaction",
    onClick: () => openExplorer(destTxHash),
  },
})

// Warning
toast.warning("Taking Longer Than Expected", {
  description: "Bridge typically takes 10-15 min. Current: 25 min.",
  action: {
    label: "Check Status",
    onClick: () => openStatusTracker(txHash),
  },
})
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

- [ ] Install Li.Fi SDK and dependencies
- [ ] Implement `LiFiBridgeService` class
- [ ] Add destination address input to UI
- [ ] Implement address validation
- [ ] Create quote fetching hook with debouncing

### Phase 2: Route Optimization (Week 2)

- [ ] Integrate Across Protocol for fast path
- [ ] Integrate Circle CCTP for USDC
- [ ] Implement smart router logic
- [ ] Add priority selector UI
- [ ] Display route visualization

### Phase 3: Security & UX (Week 3)

- [ ] Implement batch splitting for large amounts
- [ ] Add risk warnings and confirmations
- [ ] Integrate transaction status tracking
- [ ] Add recovery tools for failed transactions
- [ ] Create comprehensive error messages

### Phase 4: Testing & Polish (Week 4)

- [ ] Complete unit test coverage
- [ ] Testnet integration testing
- [ ] User acceptance testing
- [ ] Performance optimization
- [ ] Documentation and user guides

## Success Criteria

1. **Functionality**
   - Users can bridge assets between all supported chains
   - Quote accuracy within 5% of actual execution
   - Transaction success rate > 95%

2. **Performance**
   - Quote fetching < 2 seconds
   - UI remains responsive during execution
   - Status updates every 10 seconds

3. **User Experience**
   - Clear fee breakdown before execution
   - Estimated time accuracy within 20%
   - Helpful error messages with recovery options

4. **Security**
   - No loss of funds in production
   - All large transactions warned appropriately
   - Address validation prevents user errors

## Future Enhancements

- [ ] Intent-based bridging (sign once, solver executes)
- [ ] Cross-chain swap (bridge + swap in one transaction)
- [ ] Gas fee sponsorship for small amounts
- [ ] Bridge history export (CSV)
- [ ] Advanced route customization
- [ ] Multi-hop optimization (A → B → C in one flow)

## References

- [Li.Fi Documentation](https://docs.li.fi/)
- [Across Protocol Docs](https://docs.across.to/)
- [Circle CCTP Docs](https://developers.circle.com/stablecoins/docs/cctp-getting-started)
- [Wormhole Docs](https://docs.wormhole.com/)
- [LayerZero V2 Docs](https://docs.layerzero.network/v2)

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-18  
**Author**: AI Assistant (with user collaboration)  
**Status**: Ready for Implementation
