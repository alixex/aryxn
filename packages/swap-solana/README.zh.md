# @aryxn/sdk-solana

Aryxn 万能路由的 Solana 交换 SDK，原生集成 Jupiter Aggregator v6。

## 安装

```bash
pnpm add @aryxn/sdk-solana
```

## 使用方法

### 1. 初始化

```typescript
import { SolanaSwapper } from "@aryxn/sdk-solana"

const swapper = new SolanaSwapper({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  programId: "3cUyodUx...",
})

// 设置钱包与 IDL
swapper.setWallet(anchorWallet, idl)
```

### 2. 获取 Jupiter 报价

```typescript
const quote = await swapper.getQuote({
  inputMint: "...",
  outputMint: "...",
  amount: 1000000,
})
```

### 3. 执行 CPI 交换

该方法会自动从 Jupiter 获取 CPI 指令，并将其路由至 Aryxn 合约以执行手续费扣除和交易监控。

```typescript
const signature = await swapper.swap({
  user: wallet.publicKey,
  quoteResponse: quote,
})
```

## 特性

- **自动 PDA 推导**：自动处理 `router_state` 和 `token_config` 账户。
- **Jupiter v6 API 支持**：获取最优路由和动态指令数据。
- **多签友好**：兼容多种钱包实现。

## 许可证

MIT
