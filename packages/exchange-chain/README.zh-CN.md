# @aryxn/exchange-chain

用于跨链 Swap（兑换）和 Bridge（桥接）操作的统一 Exchange SDK。

## 概述

`@aryxn/exchange-chain` 提供了一个高级路由，能够智能地在同链 Swap（兑换）和跨链 Bridge（桥接）之间进行选择。它集成了 `@aryxn/swap-multichain` 用于 DEX 操作，以及 `@aryxn/cross-chain` 用于桥接服务（通过 LiFi）。

## 特色

- **统一接口**：为 Swap 和 Bridge 提供单一 API。
- **多链支持**：支持 EVM、Solana、Bitcoin 和 Arweave。
- **路由优化**：自动判断是需要进行 Swap 还是 Bridge。
- **历史记录追踪**：通过 `@aryxn/query-chain` 集成交易历史记录。

## 安装

```bash
npm install @aryxn/exchange-chain
# 或者
yarn add @aryxn/exchange-chain
# 或者
pnpm add @aryxn/exchange-chain
```

## 依赖要求

此包依赖于以下其他 `@aryxn` 工作区包：
- `@aryxn/chain-constants`
- `@aryxn/cross-chain`
- `@aryxn/query-chain`
- `@aryxn/swap-multichain`
- `@aryxn/wallet-core`

## 使用方法

### 基础示例

```typescript
import { ExchangeSDK } from '@aryxn/exchange-chain';

const sdk = new ExchangeSDK({
  ethereumContractAddress: '0x...',
  solanaProgramId: '...',
  tokenMappings: {
    // 可选的自定义代币解析
    'ETHEREUM': { 'ETH': '0x...' }
  }
});

// 获取交易路由
const route = await sdk.router.getRoute({
  fromChain: 'ETHEREUM',
  toChain: 'SOLANA',
  fromToken: 'USDC',
  toToken: 'native',
  fromAmount: '1000000', // 1 USDC (6位小数)
  recipient: '...'
});

if (route) {
  console.log(`预计输出: ${route.toAmount}`);
  console.log(`类型: ${route.type}`); // 'SWAP' 或 'BRIDGE'
}
```

## API 参考

### `ExchangeSDK`

SDK 的主要入口点。

- `constructor(config: ExchangeConfig)`：使用配置初始化 SDK。
- `router`：用于路由操作的 `ExchangeRouter` 实例。
- `history`：用于查询交易历史记录的 `AggregateHistoryProvider` 实例。

### `ExchangeRouter`

处理路由发现和优化。

- `getRoute(request: ExchangeRequest)`：为给定的请求返回最佳路由。

## 许可证

MIT
