# @aryxn/sdk-history

Aryxn 应用程序的统一多链交易历史索引器。

本软件包提供了一个标准接口，用于从主要区块链网络获取交易历史记录。它使用官方或行业标准的公共 API，旨在轻量级、非阻塞且易于集成到前端应用程序中。

## 特性 (Features)

- **多链支持**：为 Arweave、Bitcoin、Ethereum (EVM)、Solana 和 Sui 提供统一的 `ChainRecord` 接口。
- **增量同步**：分页获取记录并通过回调流式传输到 UI。
- **非阻塞设计**：利用 `requestIdleCallback`（如果可用）在浏览器空闲时间处理数据，确保持续流畅的 UI 性能。
- **性能优化**：
  - **地址验证**：自动跳过给定地址格式不正确的链。
  - **标准化类型**：归一化的交易类型 (`SEND`, `RECEIVE`, `SWAP`, `BRIDGE`)。

## 支持的链与 API

| 区块链 | 适配器 (Adapter) | API 来源 |
| :--- | :--- | :--- |
| **Arweave** | `ArweaveAdapter` | 官方网关 (`arweave.net/graphql`) |
| **Bitcoin** | `BitcoinAdapter` | Mempool.space API |
| **Ethereum** | `EVMAdapter` | Blockscout V2 API |
| **Solana** | `SolanaAdapter` | 官方主网 RPC (`api.mainnet-beta.solana.com`) |
| **Sui** | `SuiAdapter` | 官方主网 RPC (`fullnode.mainnet.sui.io`) |

## 安装

```bash
pnpm add @aryxn/sdk-history
```

## 使用方法

```typescript
import { AggregateHistoryProvider, ChainRecord } from "@aryxn/sdk-history";

// 初始化提供者
// 注意：虽然可以提供 EVM RPC URL，但目前直接使用 Blockscout API
const provider = new AggregateHistoryProvider("https://eth.llamarpc.com");

// 开始同步特定链的历史记录
// 每次发现新记录时都会调用回调函数
await provider.startSync(
  "ethereum", // 链标识符
  "0xYourWalletAddress...", // 钱包地址
  (record: ChainRecord) => {
    console.log("新交易:", record);
    // 在此处更新您的 UI 或 Store
  }
);
```

### 频率限制与缓存

`AggregateHistoryProvider` 实现了基本的内存频率限制器以防止滥用 API。如果在 1 分钟内对同一 `chain:address`对调用 `startSync`，除非将 `force` 参数设置为 true，否则将跳过请求。

### 数据结构

```typescript
export interface ChainRecord {
  id: string;          // 交易哈希 / ID
  chain: ChainType;    // "ethereum" | "solana" | "bitcoin" | "arweave" | "sui"
  type: TransactionType; // "SEND" | "RECEIVE" | ...
  status: TransactionStatus; // "COMPLETED" | "PENDING" | "FAILED"
  from: string;
  to: string;
  amount: string;      // 可读金额 (例如 "1.5")
  token: string;       // 代币符号 (例如 "ETH", "SOL")
  timestamp: number;   // Unix 时间戳 (ms)
  fee?: string;
  memo?: string;
}
```

## 许可证

AGPL-3.0-or-later
