# 🚀 快速启动指南

项目重组已完成！以下是开始使用新结构的快速指南。

---

## 🎯 常用命令

### 开发

```bash
# 启动前端开发服务器
pnpm dev

# 监听 SDK 变化（开发模式）
pnpm --filter=@alixex/sdk-ethereum dev
pnpm --filter=@alixex/sdk-solana dev
pnpm --filter=@alixex/sdk-multichain dev
```

### 构建

```bash
# 构建所有 SDK
pnpm build:sdk

# 构建以太坊合约
pnpm --filter=@alixex/contracts-ethereum build

# 构建 Solana 程序（需要 Anchor）
pnpm --filter=@alixex/contracts-solana build

# 全量构建
pnpm build:all
```

### 测试

```bash
# Lint 检查
pnpm lint

# 类型检查
pnpm type-check

# 测试以太坊合约
pnpm test:ethereum

# 测试 Solana 程序
pnpm test:solana
```

---

## 📁 新目录结构

```
aryxn/
├── apps/
│   └── vault/                        # 前端应用 (@alixex/vault)
│       ├── src/
│       ├── public/
│       └── package.json
│
└── packages/
    ├── contracts-ethereum/           # 以太坊合约
    │   ├── src/MultiHopSwapper.sol
    │   ├── script/
    │   ├── test/
    │   └── foundry.toml
    │
    ├── contracts-solana/             # Solana 程序
    │   ├── programs/multi-hop-swapper/
    │   ├── Anchor.toml
    │   └── Cargo.toml
    │
    ├── sdk-ethereum/                 # 以太坊 SDK
    │   ├── src/index.ts
    │   └── package.json
    │
    ├── sdk-solana/                   # Solana SDK
    │   ├── src/index.ts
    │   └── package.json
    │
    └── sdk-multichain/               # 跨链聚合 SDK
        ├── src/index.ts
        └── package.json
```

---

## 💡 在前端使用 SDK

### 方式 1：使用 multichain SDK（推荐）

```typescript
// apps/web/src/lib/swap.ts
import { MultiChainSwapper } from "@alixex/sdk-multichain"

export const swapper = new MultiChainSwapper({
  ethereum: {
    rpcUrl: import.meta.env.VITE_ETH_RPC_URL,
    contractAddress: import.meta.env.VITE_ETH_CONTRACT,
  },
  solana: {
    rpcUrl: import.meta.env.VITE_SOL_RPC_URL,
    programId: import.meta.env.VITE_SOL_PROGRAM,
  },
})
```

### 方式 2：单独使用链特定 SDK

```typescript
// 只使用以太坊
import { EthereumSwapper } from "@alixex/sdk-ethereum"

const ethSwapper = new EthereumSwapper({
  rpcUrl: "https://eth-mainnet...",
  contractAddress: "0x...",
})

// 获取支持的代币
const tokens = await ethSwapper.getSupportedTokens()

// 执行交换
await ethSwapper.swap({
  signer: yourSigner,
  tokenIn: "0xUSDT...",
  tokenOut: "0xWETH...",
  amountIn: 100n * 10n ** 6n, // 100 USDT
  minAmountOut: 0n,
  path: ["0xUSDT...", "0xWETH..."],
})
```

---

## 🛠️ 开发工作流

### 修改合约

```bash
# 1. 编辑合约
vim packages/contracts-ethereum/src/MultiHopSwapper.sol

# 2. 编译
pnpm --filter=@alixex/contracts-ethereum build

# 3. 测试
pnpm --filter=@alixex/contracts-ethereum test

# 4. 部署（测试网）
pnpm --filter=@alixex/contracts-ethereum deploy:sepolia
```

### 修改 SDK

```bash
# 1. 编辑 SDK
vim packages/sdk-ethereum/src/index.ts

# 2. 构建
pnpm --filter=@alixex/sdk-ethereum build

# 3. 在前端验证（自动 hot reload）
pnpm dev
```

### 修改前端

```bash
# 1. 启动开发服务器
pnpm dev

# 2. 编辑代码（自动 hot reload）
vim apps/web/src/...

# 3. Lint 检查
pnpm lint
```

---

## ⚠️ 常见问题

### Q: TypeScript 找不到 SDK 模块？

**A**: 先构建 SDK

```bash
pnpm build:sdk
```

### Q: Lint 报错 public 目录下的文件？

**A**: 已修复，`.oxlintrc.json` 已配置忽略 `public/**/*`

### Q: pnpm install 报错？

**A**: 依赖已修复，直接运行 `pnpm install` 即可

### Q: Forge 命令找不到？

**A**: 确保已安装 Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Q: Anchor 命令找不到？

**A**: 安装 Anchor CLI

```bash
cargo install --git https://github.com/coral-xyz/anchor avm
avm install latest
avm use latest
```

---
