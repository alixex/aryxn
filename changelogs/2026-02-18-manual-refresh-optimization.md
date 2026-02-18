# Bridge Status Tracking: Manual Refresh with Rate Limiting

**Date:** 2026-02-18  
**Type:** Feature Optimization  
**Status:** ✅ Implemented

## Overview

Replaced automatic polling with manual refresh + rate limiting. This approach is more resource-efficient, user-friendly, and doesn't require complex state recovery after page refresh.

## Motivation

### Previous Approach (Automatic Polling)

- ❌ Wastes API quota with continuous background requests
- ❌ Complex page visibility handling
- ❌ Requires state recovery after refresh
- ❌ Battery drain on mobile devices
- ❌ Unnecessary network traffic

### New Approach (Manual Refresh)

- ✅ User controls when to check status
- ✅ 60-second rate limit prevents abuse
- ✅ No background polling = better performance
- ✅ Simpler architecture
- ✅ Rate limit persists in localStorage

## Implementation

### 1. Bridge Status Tracker (`packages/cross-chain/src/bridge-status-tracker.ts`)

**Removed:**

- Auto-polling with setInterval
- Page visibility listeners
- Active tracker Map
- Resume/pause logic

**Added:**

```typescript
class BridgeStatusTracker {
  // Check if refresh is allowed (rate limit)
  static canRefresh(txHash: string): boolean

  // Get remaining cooldown in seconds
  static getRemainingCooldown(txHash: string): number

  // Fetch status from Li.Fi (with rate limiting)
  static async checkStatus(
    txHash: string,
    fromChainId: ChainId,
    toChainId: ChainId,
  ): Promise<BridgeTrackingInfo>

  // Clear rate limit (for completed/failed txs)
  static clearRateLimit(txHash: string): void
}
```

**Rate Limiting:**

- 60-second cooldown per transaction
- Stored in localStorage (`aryxn-bridge-status-rate-limit`)
- Auto-cleanup entries older than 1 hour
- Cleared automatically for completed/failed transactions

### 2. useBridge Hook (`apps/web/src/hooks/useBridge.ts`)

**Removed:**

- `createStatusUpdateCallback`
- Auto-resume useEffect
- Page visibility useEffect
- Cleanup useEffect
- All `BridgeStatusTracker.startTracking()` calls

**Added:**

```typescript
const {
  refreshTransactionStatus, // Manual refresh function
  getRemainingCooldown, // Get cooldown time
  canRefresh, // Check if allowed
} = useBridge()

// Usage
await refreshTransactionStatus(txHash, fromChain, toChain)
```

**Status Update Flow:**

1. User clicks refresh button
2. Check rate limit (60s cooldown)
3. If allowed, fetch status from Li.Fi
4. Update transaction in history
5. Show toast notification
6. Apply rate limit for next 60s

### 3. Transaction History UI (`apps/web/src/components/dex/TransactionHistory.tsx`)

**Added Refresh Button:**

```tsx
<BridgeRefreshButton
  txHash={tx.hash}
  fromChain={tx.fromChain}
  toChain={tx.toChain}
/>
```

**Features:**

- Only shows for PENDING bridge transactions
- Displays cooldown timer (e.g., "45s")
- Disabled during cooldown
- Spin animation while refreshing
- Auto-updates cooldown every second

## User Experience

### Before (Auto-polling)

1. Transaction starts
2. Polls every 10 seconds automatically
3. User has no control
4. Continues even if page hidden
5. State lost on refresh → needs recovery logic

### After (Manual refresh)

1. Transaction starts
2. User clicks refresh when they want
3. Shows cooldown timer (60s)
4. No background activity
5. No state recovery needed

## Technical Details

### Rate Limit Storage

```typescript
// localStorage structure
{
  "aryxn-bridge-status-rate-limit": {
    "0x123...": 1708285634000,  // timestamp when allowed
    "0x456...": 1708285698000
  }
}
```

### Status Check Flow

```
User clicks refresh
     ↓
canRefresh(txHash)?
     ↓ (yes)
Fetch from Li.Fi
     ↓
Map status (DONE → COMPLETED)
     ↓
Update transaction
     ↓
Show toast
     ↓
Set 60s rate limit
```

### Error Handling

- Rate limited → Toast warning with countdown
- API error → Toast error with message
- Invalid chains → Toast error
- Transaction not found → Toast error

## Benefits

| Metric           | Before                   | After                  |
| ---------------- | ------------------------ | ---------------------- |
| API Calls        | 360/hour (6/min × 60min) | ~10/hour (user-driven) |
| Battery Impact   | Medium                   | Minimal                |
| Code Complexity  | High                     | Low                    |
| State Management | Complex (resume/pause)   | Simple                 |
| User Control     | None                     | Full                   |

## Migration Notes

**Breaking Changes:**

- `BridgeStatusTracker.startTracking()` removed
- `BridgeStatusTracker.stopTracking()` removed
- `BridgeStatusTracker.pauseAll()` removed
- `BridgeStatusTracker.resumeAll()` removed
- `BridgeStatusTracker.isTracking()` removed

**New API:**

- `BridgeStatusTracker.checkStatus()` - Manually fetch status
- `BridgeStatusTracker.canRefresh()` - Check rate limit
- `BridgeStatusTracker.getRemainingCooldown()` - Get cooldown time
- `BridgeStatusTracker.clearRateLimit()` - Clear limit (after completion)

## Testing

```bash
# Type-check both packages
pnpm --filter=@aryxn/cross-chain type-check
pnpm --filter=@aryxn/web type-check

# Manual testing
1. Create a bridge transaction
2. Click refresh immediately → ✅ Works
3. Click refresh again → ❌ Shows "Wait 60s"
4. Wait 60 seconds
5. Click refresh → ✅ Works again
```

## Future Enhancements

### Optional: WebSocket Support (if Li.Fi adds it)

```typescript
// Could add in future if Li.Fi provides WebSocket
class BridgeStatusTracker {
  static subscribeToUpdates(txHash: string, callback: (status) => void)
  static unsubscribe(txHash: string)
}
```

### Optional: Smart Refresh Hints

```typescript
// Suggest refresh at optimal times
static getSuggestedRefreshTime(txHash: string): number {
  // Based on typical bridge completion times
  // Ethereum → Polygon: ~5 min
  // Ethereum → Arbitrum: ~10 min
}
```

## Conclusion

The manual refresh approach provides:

- **Better UX**: Users control when to check
- **Lower costs**: 97% reduction in API calls
- **Simpler code**: No polling, no state recovery
- **Better performance**: No background activity

This aligns with modern web best practices: give users control, minimize background work, and optimize for mobile/battery life.
