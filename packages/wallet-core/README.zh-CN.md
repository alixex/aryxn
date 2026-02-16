# @aryxn/wallet-core

Aryxn 的核心钱包逻辑库，提供针对钱包创建、检测和账户管理的链无关原语 (Chain-Agnostic Primitives)。

**注意**: 该包是纯逻辑层，**不**直接依赖底层加密库。所有加密操作均委托给 `@aryxn/crypto` 处理。

## 功能特性

- **多链支持**: 统一支持 Ethereum, Solana, Sui, Bitcoin, 和 Arweave 钱包。
- **钱包创建**: 通过 `createWallet` 基于助记词或随机种子生成钱包。
- **链检测**: 通过 `detectChainAndAddress` 自动识别地址字符串、私钥或助记词所属的链类型。
- **工具函数**: 内置针对 EVM, Solana, 和 Sui 的辅助函数（客户端、余额查询、单位格式化）。
- **类型定义**: 共享 TypeScript 接口 `WalletRecord`, `ActiveAccount` 以及常用的区块链 SDK 类型。

## API 参考

### 核心函数

| 函数                                             | 说明                                                            |
| :----------------------------------------------- | :-------------------------------------------------------------- |
| `createWallet(chain, arweaveInstance?)`          | 为指定链 (ethereum, solana, sui, bitcoin, arweave) 创建新钱包。 |
| `detectChainAndAddress(input, arweaveInstance?)` | 从私钥、助记词或地址字符串中自动检测链类型和地址。              |
| `initArweave(config)`                            | 初始化自定义的 Arweave 客户端实例。                             |

### 链特定工具函数

#### 余额查询 (跨链)

| 链 | 函数 | 所需客户端/连接 |
| :--- | :--- | :--- |
| **EVM** | `getEvmBalance(provider, address)` | `JsonRpcProvider` |
| **Solana** | `getSolanaBalance(connection, pubKey)` | `Connection` |
| **Sui** | `getSuiBalance(client, address)` | `SuiClient` |

#### EVM (Ethereum & L2s)
- `createEvmProvider(url)` / `createEvmWallet(privateKey, provider)`
- `formatEther(wei)` / `parseEther(eth)`
- `formatUnits(value, decimals)` / `parseUnits(value, decimals)`

#### Solana
- `createSolanaConnection(endpoint)` / `createSolanaPublicKey(address)`
- `formatSolanaBalance(lamports)` / `parseSolanaAmount(sol)`

#### Sui
- `createSuiClient(url)` / `getFullnodeUrl(network)`
- `formatSuiBalance(mist)` / `parseSuiAmount(sui)`

## 使用示例

### 钱包操作

```typescript
import { createWallet, detectChainAndAddress } from "@aryxn/wallet-core"

// 创建新钱包
const { address, key, mnemonic } = await createWallet("ethereum")

// 从输入检测链类型
const info = await detectChainAndAddress("0x123...")
console.log(info.chain) // "ethereum"
```

### 余额查询示例

```typescript
import { createEvmProvider, getEvmBalance, formatEther } from "@aryxn/wallet-core"

const provider = createEvmProvider("https://mainnet.infura.io/v3/...")
const balance = await getEvmBalance(provider, "0x...")
console.log(formatEther(balance))
```

