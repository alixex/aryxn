# @aryxn/cross-chain

Aryxn 的跨链桥和交换聚合逻辑。

该包提供在不同区块链之间桥接资产的服务，允许用户将资产从不受支持的链或代币移动到受支持的支付代币（如 ETH, SOL, USDC）。

## 安装

```bash
pnpm add @aryxn/cross-chain
```

## 使用

```typescript
import { BridgeService } from "@aryxn/cross-chain";
import { MultiChainSwapper } from "@aryxn/swap-multichain";

// 初始化交换器（依赖项）
const swapper = new MultiChainSwapper(...);

// 初始化桥接服务
const bridgeService = new BridgeService(swapper);

// 检查代币是否需要桥接
if (BridgeService.requiresBridge("SOME_TOKEN")) {
  // 执行桥接
  const result = await bridgeService.bridgeAsset({
    fromToken: "SOME_TOKEN",
    toToken: "ETH",
    amount: "100",
    userAddress: "0x...",
    walletKey: walletKey
  });

  console.log("Bridge Tx:", result.txId);
}
```

## 功能特性

- **桥接服务**：处理跨链资产转移。
- **代币检查**：检查代币是否需要桥接 (`requiresBridge`) 的实用工具。
