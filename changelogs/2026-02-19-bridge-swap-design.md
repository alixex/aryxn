# Bridge Swap (USDC/USDT Cross-Chain) Design

> **Design Status**: Ready for Implementation
>
> **Date**: February 19, 2026

---

## 1. Overview

**Goal**: Enable users to swap assets across different blockchains with automatic routing to USDC or USDT on the destination chain.

**Scope**:

- Cross-chain swaps limited to **USDC and USDT only** (intermediate assets)
- Bidirectional support:
  - `Any asset → USDC/USDT → Destination chain`
  - `USDC/USDT on source chain → BTC or AR on Bitcoin/Arweave`
- Supports all major chains: Ethereum, Solana, Arbitrum, Optimism, Polygon, Bitcoin, Arweave
- Integrated into existing Swap UI with smart detection
- Powered by **Li.Fi API** for optimal routing

**Key Constraints**:

- For non-BTC/AR sources: Output to USDC/USDT on destination chain
- For BTC/AR as destination: Input must accept USDC/USDT on source chain
- BTC/AR output destinations only available if user has account on those chains

---

## 2. Architecture

### 2.1 High-Level Flow

```
User selects input account/asset + amount
        ↓
Detect: Same chain? → Use existing Swap flow
        Different chain? → Use Bridge Swap flow
        ↓
User selects destination chain
        ↓
Query Li.Fi: Get route (input asset → USDC/USDT on dest chain)
        ↓
Show preview: amount out, fees, estimated time
        ↓
User confirms
        ↓
Execute on-chain operations (signatures, approvals, bridge)
        ↓
Record in transaction history
```

### 2.2 Component Structure

```
SwapCard.tsx (existing)
├── Detect: isInputBtcOrAr() || isDifferentChain()
├── If same chain → useMultiHopSwap (existing)
├── If cross-chain → useBridgeSwap (new)
│   ├── useLiFiRoute(inputToken, amount, destChain)
│   ├── useBridgeEstimate()
│   └── useBridgeExecute()
└── UI render based on flow type

useBridgeSwap.ts (new hook)
├── queryLiFiRoute()
├── buildBridgeTransaction()
├── executeRoute()
└── Error mapping + history recording
```

### 2.3 Supported Chain Pairs

```
Source → Destination (Output: USDC/USDT)
Ethereum (ETH)      → SOL, Arbitrum, Optimism, Polygon, Bitcoin, Arweave
Solana (SOL)        → Ethereum, Arbitrum, Optimism, Polygon, Bitcoin, Arweave
Arbitrum (ARB)      → Ethereum, Solana, Optimism, Polygon, Bitcoin, Arweave
Optimism (OP)       → Ethereum, Solana, Arbitrum, Polygon, Bitcoin, Arweave
Polygon (MATIC)     → Ethereum, Solana, Arbitrum, Optimism, Bitcoin, Arweave
Bitcoin (BTC)       → Ethereum, Solana (output: USDC/USDT)
Arweave (AR)        → Ethereum, Solana (output: USDC/USDT)

Reverse Direction (Input: USDC/USDT, Output: BTC/AR)
Ethereum USDC       → Bitcoin BTC
Ethereum USDT       → Bitcoin BTC
Ethereum USDC       → Arweave AR
Ethereum USDT       → Arweave AR
Solana USDC         → Bitcoin BTC
Solana USDT         → Bitcoin BTC
Solana USDC         → Arweave AR
Solana USDT         → Arweave AR
```

---

## 3. UI Design

### 3.1 Input/Output Selection

**Current (Single-Chain Swap)**:

```
Input:  [Chain: Ethereum] [Token: ETH ↓]  [Amount: ____]
        ↓
Output: [Token: USDC ↓]  [Receive: ____]
```

**New (Bridge Swap Forward - Any → USDC/USDT)**:

```
Input:  [Chain: Bitcoin] [Token: BTC ↓]  [Amount: ____]
        ↓
Output: [Chain: Ethereum ↓] [Token: USDC/USDT]  [Receive: ____]
```

**New (Bridge Swap Reverse - USDC/USDT → BTC/AR)**:

```
Input:  [Chain: Ethereum] [Token: USDT ↓]  [Amount: ____]
        ↓
Output: [Chain: Bitcoin ↓] [Token: BTC]  [Receive: ____]
```

**Rules**:

- Forward: Input any asset, output always USDC or USDT
- Reverse: Input must be USDC/USDT, output to BTC or AR
- Output chain selector appears only for cross-chain swaps
- BTC/AR appear as output options only if user has verified account on those chains

### 3.2 Detection Logic in SwapCard

```typescript
const isBridgeSwap = () => {
  const inputChain = selectedAccount.chain
  const outputChain = selectedOutputChain

  // Bridge swap if:
  // 1. Different chains
  // 2. OR input is BTC/AR (no meaningful same-chain swaps)
  // 3. OR output is BTC/AR (requires bridge from USDC/USDT)

  const isDifferentChain = inputChain !== outputChain
  const isNativeAssetOnly = isBtcOrAr(inputChain)
  const isBtcOrArDestination = isBtcOrAr(outputChain)

  return isDifferentChain || isNativeAssetOnly || isBtcOrArDestination
}

const getAvailableOutputChains = () => {
  const inputChain = selectedAccount.chain

  // BTC/AR can only bridge TO stablecoins on other chains
  if (isBtcOrAr(inputChain)) {
    return [Chains.ETHEREUM, Chains.SOLANA] // output must be USDC/USDT
  }

  // Other chains can bridge TO other chains or to BTC/AR
  const allChains = [...standardChains, Chains.BITCOIN, Chains.ARWEAVE]
  return allChains.filter((c) => c !== inputChain)
}

const getAvailableOutputTokens = () => {
  const outputChain = selectedOutputChain

  // If output is BTC/AR, show only that native asset
  if (outputChain === Chains.BITCOIN) {
    return [{ symbol: "BTC", address: "native" }]
  }
  if (outputChain === Chains.ARWEAVE) {
    return [{ symbol: "AR", address: "native" }]
  }

  // If output is a stablecoin chain, show USDC/USDT
  return [
    { symbol: "USDC", address: getUsdcAddress(outputChain) },
    { symbol: "USDT", address: getUsdtAddress(outputChain) },
  ]
}
```

### 3.3 Preview Panel (Bridge Mode)

```
┌─────────────────────────────────┐
│ Bridge Swap Details             │
├─────────────────────────────────┤
│ Amount:           1 BTC          │
│ Route:            BTC → wBTC ... │
│ Output:           49,500 USDT    │
├─────────────────────────────────┤
│ Bridge Fee:       0.5%           │
│ Estimated Time:   ~30 minutes    │
│ Exchange Rate:    1 BTC = 49,XXX │
├─────────────────────────────────┤
│ ⓘ Bridge via Stargate           │
└─────────────────────────────────┘
```

---

## 4. Data Flow

### 4.1 Route Query Flow

**Forward Flow (Any → USDC/USDT)**:

```typescript
// 1. User Input
input: {
  fromChain: "Bitcoin",
  fromToken: "BTC",
  fromAmount: "1",
  toChain: "Ethereum",
  toToken: "USDT", // Always USDC or USDT when output chain is EVM/Solana
}

// 2. Query Li.Fi
route = await lifi.getRoutes({
  fromChain: "BTC",
  fromToken: "0x...", // wrapped BTC address
  toChain: "Ethereum",
  toToken: "0xUSDT_address",
  amount: "100000000", // 1 BTC in sats
})

// 3. Response
{
  routes: [
    {
      fromChain, toChain, fromToken, toToken,
      fromAmount: "100000000",
      toAmount: "4950000000", // 49.5 USDT (6 decimals)
      steps: [
        { tool: "Stargate", action: "bridge", ... },
        { tool: "Uniswap", action: "swap", ... },
      ],
      ...
    }
  ]
}
```

**Reverse Flow (USDC/USDT → BTC/AR)**:

````typescript
// 1. User Input
input: {
  fromChain: "Ethereum",
  fromToken: "USDT",
  fromAmount: "50000",
  toChain: "Bitcoin",
  toToken: "BTC", // Native asset on Bitcoin chain
}

// 2. Query Li.Fi
route = await lifi.getRoutes({
  fromChain: "Ethereum",
  fromToken: "0xUSDT_address",
  toChain: "BTC", // Bitcoin chain ID
  toToken: "0x...", // Wrapped BTC address or native
  amount: "50000000000", // 50k USDT (6 decimals)
})

// 3. Response
{
  routes: [
    {
      fromChain: "Ethereum",
      toChain: "Bitcoin",
      fromToken: "USDT",
      toToken: "BTC",
      fromAmount: "50000000000",
      toAmount: "100000000", // 1 BTC in sats
      steps: [
        { tool: "Uniswap", action: "swap", ... }, // USDT → USDC for better liquidity
        { tool: "Stargate", action: "bridge", ... }, // to Bitcoin
      ],
      ...
    }
  ]
}

### 4.2 Execution Flow

**Forward Execution (Any → USDC/USDT)**:
```typescript
// BTC → Ethereum USDT example

// 1. Build transactions from Li.Fi route
transactions = await lifi.getSteps(route)
  // Returns: [approve BTC, bridge BTC, swap on Ethereum]

// 2. Prepare Bitcoin transaction separately (native BTC send)
if (input.fromChain === "Bitcoin") {
  btcTx = await buildSignedBitcoinTransferTx({
    fromWif: userBtcPrivateKey,
    toAddress: bridgeContractAddress,
    amountSats: route.fromAmount,
    feeSats: calculateBtcFee(),
  })
  // Broadcast BTC tx
  broadcastBitcoinTx(btcTx.hex)
}

// 3. Execute on EVM/Solana as needed
for each tx in transactions:
  - Sign with user wallet
  - Broadcast
  - Wait for confirmation

// 4. Record in history
recordTransaction({
  type: "BRIDGE_SWAP",
  direction: "forward",
  fromChain: "Bitcoin",
  toChain: "Ethereum",
  fromToken: "BTC",
  toToken: "USDT",
  txHashes: [...],
})
````

**Reverse Execution (USDC/USDT → BTC/AR)**:

```typescript
// Ethereum USDT → Bitcoin BTC example

// 1. Build transactions from Li.Fi route
transactions = await lifi.getSteps(route)
  // Returns: [approve USDT, bridge USDT, swap if needed]

// 2. Execute on source chain (EVM)
for each tx in transactions:
  - Sign with EVM wallet
  - Broadcast to Ethereum
  - Wait for confirmation

// 3. Monitor bridge completion
status = await lifi.getStatus(route)
  // Poll until: USDT arrived on Bitcoin chain

// 4. Final delivery to user's BTC address
// Li.Fi should handle this, but verify:
btcAddress = selectedAccount.address // Bitcoin address
// Confirm Li.Fi sent to correct address

// 5. Record in history
recordTransaction({
  type: "BRIDGE_SWAP",
  direction: "reverse",
  fromChain: "Ethereum",
  toChain: "Bitcoin",
  fromToken: "USDT",
  toToken: "BTC",
  txHashes: [...],
  destinationAddress: btcAddress,
})
```

---

## 5. Technical Stack

### 5.1 Dependencies

- **Li.Fi SDK** (`@lifi/sdk`) - Route finding and transaction building
- **wagmi** - EVM wallet interactions
- **@solana/web3.js** - Solana interactions
- **viem** - Ethereum utilities
- **axios** - HTTP client for Li.Fi API fallback
- **bitcoinjs-lib** - BTC transaction preparation (already in use)

### 5.2 New Files to Create

```
apps/web/src/
├── lib/
│   ├── bridge/
│   │   ├── lifi-client.ts          # Li.Fi API wrapper
│   │   ├── route-types.ts          # Type definitions
│   │   └── bridge-errors.ts        # Error classification
│   └── store/
│       └── bridge-swap-repo.ts     # SQLite storage for bridge history
├── hooks/
│   └── bridge-hooks/
│       ├── use-lifi-route.ts       # Query Li.Fi routes
│       ├── use-bridge-swap.ts      # Main bridge swap hook
│       └── use-bridge-execute.ts   # Handle execution
└── components/
    └── bridge/
        ├── BridgePreview.tsx       # Preview panel
        └── BridgeGasEstimate.tsx   # Fee breakdown
```

### 5.3 API Integration Points

```typescript
// Li.Fi API
https://li.quest/v1/routes
  - Query optimal cross-chain routes

https://li.quest/v1/quote
  - Get detailed quote before execution

https://li.quest/v1/steps
  - Get transaction steps to execute

https://li.quest/v1/status
  - Poll for transaction status
```

---

## 6. Implementation Plan

### Phase A: Foundation (API & Types)

1. Create `lib/bridge/lifi-client.ts`
   - Li.Fi API client wrapper
   - Handle route queries
   - Error handling

2. Create `lib/bridge/route-types.ts`
   - TypeScript interfaces for routes
   - Bridge transaction types
   - Status tracking

3. Create `lib/bridge/bridge-errors.ts`
   - Map Li.Fi errors to user messages
   - Classify by: insufficient balance, failed bridge, bad route, etc.

### Phase B: Storage & State

4. Create `lib/store/bridge-swap-repo.ts`
   - SQLite repository for bridge swaps
   - Same pattern as `bridge-history-repo.ts`
   - Store route details, status, progress

5. Extend `useBridgeHistory` store
   - Add BRIDGE_SWAP transaction type
   - Multi-step transaction tracking
   - Progress updates

### Phase C: Hooks & Logic

6. Create `hooks/bridge-hooks/use-lifi-route.ts`
   - Query routes with debounce
   - Cache recent routes
   - Return loading/error states

7. Create `hooks/bridge-hooks/use-bridge-swap.ts`
   - Execute bridge swap workflow
   - Handle multi-step transactions
   - Poll for completion
   - Error recovery

### Phase D: UI Integration

8. Modify `SwapCard.tsx`
   - Add output chain selector (swap mode specific)
   - Detect bridge vs. swap modes
   - Conditional rendering of UI

9. Create `BridgePreview.tsx`
   - Show route steps and fees
   - Display bridge provider
   - Estimated completion time

10. Add bridge validation
    - Ensure output is USDC or USDT
    - Validate chain combinations
    - Warn if route is slow

---

## 7. Error Handling

### 7.1 Error Categories

```typescript
enum BridgeErrorType {
  // Route/Quote errors
  NO_ROUTE_FOUND = "No route found for this pair",
  INVALID_AMOUNT = "Amount too small or too large",
  SLIPPAGE_TOO_HIGH = "Price impact too high",

  // Execution errors
  INSUFFICIENT_BALANCE = "Not enough balance in source currency",
  BRIDGE_FAILED = "Bridge transaction failed",
  BRIDGE_TIMEOUT = "Bridge took too long, may need manual intervention",

  // User errors
  INVALID_CHAIN = "Invalid destination chain",
  UNSUPPORTED_PAIR = "This pair not supported",

  // API errors
  LIFI_API_DOWN = "Li.Fi API temporarily unavailable",
  NETWORK_ERROR = "Network request failed",
}
```

### 7.2 Recovery Strategies

```typescript
// If route fails:
1. Show error message
2. Offer to retry after 5 seconds
3. If repeated failures, suggest manual bridge via Li.Fi website
4. Store failure in history for debugging

// If bridge stalls:
1. Poll status every 30 seconds
2. After 1 hour, mark as "PENDING_MANUAL_INTERVENTION"
3. Provide link to check on Li.Fi explorer
```

---

## 8. Input/Output Validation Rules

### 8.1 Forward Flow Validation (Any → USDC/USDT)

```typescript
// Allowed combinations:
✅ BTC → Ethereum USDC
✅ BTC → Solana USDT
✅ AR → Ethereum USDC
✅ AR → Solana USDT
✅ ETH → Solana USDC
✅ SOL → Ethereum USDT
✅ Any EVM token → any chain USDC/USDT

// NOT allowed:
❌ USDC → USDT (same stable pair, use internal swap instead)
❌ BTC → BTC (no same-chain option)
❌ AR → AR (no same-chain option)
```

### 8.2 Reverse Flow Validation (USDC/USDT → BTC/AR)

```typescript
// Allowed combinations:
✅ Ethereum USDC → Bitcoin BTC
✅ Ethereum USDT → Bitcoin BTC
✅ Solana USDC → Bitcoin BTC
✅ Solana USDT → Bitcoin BTC
✅ Ethereum USDC → Arweave AR
✅ Ethereum USDT → Arweave AR
✅ Solana USDC → Arweave AR
✅ Solana USDT → Arweave AR

// NOT allowed:
❌ Arbitrum USDC → Bitcoin BTC (low liquidity, not supported)
❌ Ethereum USDC → USDC (same chain, use transfer instead)
❌ Ethereum USDC → Ethereum USDT (use internal swap)

// Prerequisites:
✅ User must have verified BTC address (if output is BTC)
✅ User must have verified AR address (if output is AR)
✅ Destination address must be valid (BTC: bc1..., AR: normal address)
```

### 8.3 Runtime Validation

```typescript
const validateBridgeSwap = (input, output) => {
  // 1. Check output chain has account
  if (isBtcOrAr(output.chain)) {
    const hasAccount = userAccounts.some(
      (acc) => acc.chain === output.chain && acc.address,
    )
    if (!hasAccount) {
      throw new Error(
        `Please add a ${output.chain} account before bridging to ${output.token}`,
      )
    }
  }

  // 2. Check reverse flow constraints
  if (output.token === "BTC" || output.token === "AR") {
    const isStableInput = input.token === "USDC" || input.token === "USDT"
    if (!isStableInput) {
      throw new Error("Reverse bridge requires USDC or USDT as input")
    }
  }

  // 3. Check forward flow constraints
  if (input.chain !== output.chain) {
    const isStableOutput = output.token === "USDC" || output.token === "USDT"
    if (!isStableOutput && !isBtcOrAr(output.chain)) {
      throw new Error("Cross-chain output must be USDC, USDT, BTC, or AR")
    }
  }

  // 4. Check route availability
  const supportedPairs = getSupportedBridgePairs()
  const pairKey = `${input.chain}::${output.chain}`
  if (!supportedPairs.includes(pairKey)) {
    throw new Error(
      `Bridge from ${input.chain} to ${output.chain} not supported yet`,
    )
  }
}
```

---

## 9. Testing Strategy

### Unit Tests

- Route query parsing and validation
- Error classification logic
- Fee calculations and conversions
- Chain/token compatibility matrix
- Input/output validation rules
- Forward flow detection
- Reverse flow detection

### Integration Tests

- Mock Li.Fi API responses
- Test full bridge swap flow (forward)
- Test full bridge swap flow (reverse)
- Test error scenarios
- Test status polling
- Test multi-step transaction handling (BTC send + bridge)

### E2E Tests (if enabled)

- Real Li.Fi testnet (if available)
- Swap on testnet chains (forward and reverse)
- Verify transaction history recording
- Verify destination address correctness

---

## 10. Transaction History Integration

### 10.1 New Transaction Type

```typescript
interface BridgeSwapTransaction {
  id: string
  type: "BRIDGE_SWAP"
  direction: "forward" | "reverse" // forward: any→usdc/usdt; reverse: usdc/usdt→btc/ar
  status: "PENDING" | "CONFIRMING" | "SWAPPING" | "COMPLETED" | "FAILED"

  fromChain: string
  toChain: string
  fromToken: string // e.g., "BTC", "USDT", "ETH"
  toToken: string // e.g., "USDC", "USDT", "BTC", "AR"

  fromAmount: string // in original decimals
  toAmount: string // expected output

  feePercentage: number
  bridgeProvider: string // "Stargate", "Across", etc.
  estimatedTime: number // seconds

  txHashes: string[] // multiple tx hashes (BTC send, bridge, swap, etc.)
  destinationAddress?: string // For BTC/AR, the receiving address

  createdAt: timestamp
  updatedAt: timestamp
}
```

### 10.2 Status Progression

```
PENDING (user confirms)
  ↓
CONFIRMING (first tx confirming)
  ↓
SWAPPING (bridge executing)
  ↓
COMPLETED (user receives destination token)

OR

FAILED (at any step)
```

---

## 11. UI States & Transitions

### 11.1 Input Mode Detection

```
User selects input
  ↓
Query balance, supported chains
  ↓
If BTC/AR → Show only cross-chain outputs (default)
If ETH/SOL/etc →
  Show both same-chain swap and cross-chain options

  Toggle: "Swap on this chain" vs "Bridge to another chain"
```

### 11.2 Loading States

```
Route Loading:        "Fetching best route..." (debounce 500ms)
Executing:            "Confirming on-chain... (Step X of Y)"
Polling:              "Waiting for bridge... Est. 5 mins"
Complete:             "Swap completed ✓"
Error:                "Bridge failed - [reason]. Retry?"
```

---

## 12. Performance Considerations

- **Route caching**: Cache routes for 60 seconds to avoid API spam
- **Debounce**: 500ms debounce on route queries (user typing)
- **Polling interval**: 30-60 seconds while bridge is executing
- **UI optimization**: Don't block on Li.Fi queries, show skeleton UI

---

## 13. Security Considerations

- **Route validation**: Always verify output token is USDC/USDT/BTC/AR before execution
- **Amount validation**: Ensure slippage is within user's tolerance
- **Bridge provider verification**: Warn if bridge provider is unknown or high-risk
- **Destination validation**: For BTC/AR outputs, validate address format before sending
- **Never auto-approve**: Always require explicit user confirmation per transaction

---

## 14. Success Criteria

✅ Routes correctly fetched from Li.Fi for all chain pairs (forward and reverse)
✅ Bridge swaps execute and complete (both directions)
✅ BTC/AR destinations validated before sending
✅ Transaction history records multi-step swaps with direction
✅ Error messages are user-friendly and actionable
✅ UI transparently shows fees, time, bridge provider, destination
✅ Can recover from failed bridge with manual retry
✅ All tests pass, no TypeScript errors
✅ Reverse flow validation prevents invalid combinations

---

## 15. Rollout Plan

**Phase 1 - Beta** (Internal testing)

- Limited to testnet or specific pairs
- Test forward and reverse flows
- Monitor Li.Fi API stability
- Gather user feedback on UX

**Phase 2 - Mainnet** (Full release)

- Enable all supported chains (forward and reverse)
- Add to main Swap page
- Add warnings for BTC/AR destinations
- Monitor for issues, be ready to disable

**Phase 3 - Polish** (Post-launch)

- i18n translations
- Performance optimizations
- Advanced UTXO/route selection

---

## 16. References

- Li.Fi Documentation: https://docs.li.fi/
- Supported Bridges: https://docs.li.fi/bridges
- API Reference: https://docs.li.fi/reference/api-reference
- Chain IDs: https://docs.li.fi/chains

---

**Next Step**: Proceed to implementation plan and start Phase A (Foundation)
