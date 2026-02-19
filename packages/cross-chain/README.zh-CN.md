# @aryxn/cross-chain

Aryxn 的跨链工具包，核心基于 Li.Fi 路由/执行能力，并提供状态跟踪、交易模拟与故障恢复能力。

## 安装

```bash
pnpm add @aryxn/cross-chain
```

## API 使用

该包主要通过 `liFiBridgeService`、`BridgeStatusTracker`、`BridgeRecovery`、模拟与地址工具来集成。

### 1）获取路由、成本与风险

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

### 2）用 signer 执行桥接

```typescript
import { liFiBridgeService } from "@aryxn/cross-chain"
import type { Signer } from "ethers"

const txHash = await liFiBridgeService.executeBridgeTransaction(route, signer as Signer)
```

### 3）状态查询（手动刷新场景）

```typescript
import { BridgeStatusTracker } from "@aryxn/cross-chain"

if (BridgeStatusTracker.canRefresh(txHash)) {
  const info = await BridgeStatusTracker.checkStatus(txHash, fromChainId, toChainId)
  console.log(info.status, info.substatus)
}
```

### 4）恢复流程（重试 / Claim 指引 / 加速）

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

### 5）执行前模拟

```typescript
import { simulateBridgeRoute } from "@aryxn/cross-chain"

const simulation = await simulateBridgeRoute(route)
if (simulation.status === "FAILED") {
  throw new Error(simulation.error || "Simulation failed")
}
```

### 6）地址与链辅助工具

```typescript
import {
  validateAddress,
  getChainIdFromName,
  getAddressPlaceholder,
} from "@aryxn/cross-chain"

const chainId = getChainIdFromName("ethereum")
const isValid = chainId ? validateAddress("0x...", chainId) : false
```

## 主要导出

- `LiFiBridgeService`, `liFiBridgeService`
- `BridgeStatusTracker`
- `BridgeRecovery`
- `simulateBridgeRoute` 及相关模拟工具
- 地址工具（`validateAddress`, `getChainIdFromName` 等）
- `requiresBridge`

## 说明

- 该包依赖 `@lifi/sdk` 与可签名的钱包能力。
- 在前端集成时，建议配合应用侧持久化交易历史状态管理一起使用。
