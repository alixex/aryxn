# Aryxn 项目结构

## 🎯 设计原则

1. **清晰的职责分离** - 前端、合约、SDK 独立管理
2. **Monorepo 最佳实践** - 使用 pnpm workspace 管理依赖
3. **多链友好** - 以太坊和 Solana 平行管理
4. **便于扩展** - 易于添加新链支持

---

## 📁 推荐的目录结构

```
aryxn/
├── apps/                              # 应用层
│   └── web/                          # Web 前端应用（原 client/）
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── lib/
│       │   │   ├── ethereum/         # 以太坊相关逻辑
│       │   │   ├── solana/           # Solana 相关逻辑
│       │   │   └── swap/             # 通用交换逻辑
│       │   └── types/
│       ├── public/
│       ├── package.json
│       ├── vite.config.ts
│       └── tsconfig.json
│
├── packages/                          # 共享包
│   ├── contracts-ethereum/           # 以太坊合约包
│   │   ├── src/
│   │   │   ├── MultiHopSwapper.sol
│   │   │   └── interfaces/
│   │   ├── script/                   # 部署脚本
│   │   ├── test/                     # 测试
│   │   ├── foundry.toml
│   │   └── package.json
│   │
│   ├── contracts-solana/             # Solana 合约包
│   │   ├── programs/
│   │   │   └── multi-hop-swapper/
│   │   │       ├── src/
│   │   │       │   └── lib.rs
│   │   │       └── Cargo.toml
│   │   ├── tests/
│   │   ├── Anchor.toml
│   │   ├── Cargo.toml
│   │   └── package.json
│   │
│   ├── sdk-ethereum/                 # 以太坊 SDK
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── swapper.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sdk-solana/                   # Solana SDK
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── swapper.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── sdk-multichain/               # 跨链 SDK（聚合层）
│       ├── src/
│       │   ├── index.ts
│       │   ├── multichain-swapper.ts
│       │   ├── chain-router.ts       # 自动选择最优链
│       │   └── types.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                              # 文档
│   ├── architecture/
│   │   ├── ethereum.md
│   │   ├── solana.md
│   │   └── multichain.md
│   ├── api/
│   │   ├── sdk-reference.md
│   │   └── contract-abi.md
│   └── guides/
│       ├── deployment.md
│       └── integration.md
│
├── scripts/                           # 全局脚本
│   ├── setup.sh
│   ├── deploy-all.sh
│   └── generate-types.ts
│
├── .github/
│   └── workflows/
│       ├── ci-web.yml
│       ├── ci-ethereum.yml
│       └── ci-solana.yml
│
├── package.json                       # Workspace 根配置
├── pnpm-workspace.yaml
├── tsconfig.json                      # 共享 TS 配置
├── .prettierrc
├── .editorconfig
└── README.md
```

---

## 📦 Package 依赖关系

```
apps/web
├── @aryxn/sdk-multichain
│   ├── @aryxn/sdk-ethereum
│   │   └── @aryxn/contracts-ethereum (ABI)
│   └── @aryxn/sdk-solana
│       └── @aryxn/contracts-solana (IDL)
```

---

## 🔧 pnpm-workspace.yaml 配置

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 📝 各包的 package.json 配置

### 根 package.json

```json
{
  "name": "aryxn-workspace",
  "private": true,
  "version": "1.0.0",
  "description": "A user-sovereignty-first vault with integrated DEX",
  "license": "AGPL-3.0-or-later",
  "packageManager": "pnpm@10.28.1",
  "scripts": {
    "dev": "pnpm --filter=@aryxn/web dev",
    "build": "pnpm --filter=@aryxn/web build",
    "build:contracts": "pnpm --filter='@aryxn/contracts-*' build",
    "build:sdk": "pnpm --filter='@aryxn/sdk-*' build",
    "build:all": "pnpm build:contracts && pnpm build:sdk && pnpm build",

    "test:web": "pnpm --filter=@aryxn/web test",
    "test:ethereum": "pnpm --filter=@aryxn/contracts-ethereum test",
    "test:solana": "pnpm --filter=@aryxn/contracts-solana test",
    "test:all": "pnpm test:web && pnpm test:ethereum && pnpm test:solana",

    "deploy:ethereum": "pnpm --filter=@aryxn/contracts-ethereum deploy",
    "deploy:solana": "pnpm --filter=@aryxn/contracts-solana deploy",

    "lint": "pnpm --filter='./apps/*' lint",
    "format": "prettier --write .",
    "type-check": "pnpm --filter='./apps/*' type-check"
  }
}
```

### packages/contracts-ethereum/package.json

```json
{
  "name": "@aryxn/contracts-ethereum",
  "version": "1.0.0",
  "description": "Ethereum smart contracts for multi-hop swaps",
  "license": "MIT",
  "scripts": {
    "build": "forge build",
    "test": "forge test -vvv",
    "deploy": "forge script script/Deploy.s.sol --broadcast",
    "deploy:sepolia": "forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify",
    "deploy:mainnet": "forge script script/Deploy.s.sol --rpc-url mainnet --broadcast --verify",
    "format": "forge fmt",
    "lint": "forge fmt --check"
  },
  "files": ["out/**/*.json", "src/**/*.sol"]
}
```

### packages/contracts-solana/package.json

```json
{
  "name": "@aryxn/contracts-solana",
  "version": "1.0.0",
  "description": "Solana programs for multi-hop swaps",
  "license": "MIT",
  "scripts": {
    "build": "anchor build",
    "test": "anchor test",
    "deploy": "anchor deploy",
    "deploy:devnet": "anchor deploy --provider.cluster devnet",
    "deploy:mainnet": "anchor deploy --provider.cluster mainnet",
    "idl:init": "anchor idl init -f target/idl/multi_hop_swapper.json",
    "idl:upgrade": "anchor idl upgrade -f target/idl/multi_hop_swapper.json"
  },
  "files": ["target/idl/**/*.json", "target/types/**/*.ts"]
}
```

### packages/sdk-ethereum/package.json

```json
{
  "name": "@aryxn/sdk-ethereum",
  "version": "1.0.0",
  "description": "TypeScript SDK for Ethereum swaps",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "oxlint src",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "ethers": "^6.16.0"
  },
  "devDependencies": {
    "@aryxn/contracts-ethereum": "workspace:*",
    "typescript": "~5.9.3"
  },
  "files": ["dist"]
}
```

### packages/sdk-solana/package.json

```json
{
  "name": "@aryxn/sdk-solana",
  "version": "1.0.0",
  "description": "TypeScript SDK for Solana swaps",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "oxlint src",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@project-serum/anchor": "^0.29.0",
    "@solana/web3.js": "^1.98.4"
  },
  "devDependencies": {
    "@aryxn/contracts-solana": "workspace:*",
    "typescript": "~5.9.3"
  },
  "files": ["dist"]
}
```

### packages/sdk-multichain/package.json

```json
{
  "name": "@aryxn/sdk-multichain",
  "version": "1.0.0",
  "description": "Unified SDK for cross-chain swaps",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "oxlint src",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@aryxn/sdk-ethereum": "workspace:*",
    "@aryxn/sdk-solana": "workspace:*"
  },
  "devDependencies": {
    "typescript": "~5.9.3"
  },
  "files": ["dist"]
}
```

### apps/web/package.json

```json
{
  "name": "@aryxn/web",
  "version": "1.0.0",
  "private": true,
  "description": "Aryxn web application",
  "license": "AGPL-3.0-or-later",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "pnpm type-check && oxlint .",
    "type-check": "tsc --noEmit",
    "format": "prettier --write src"
  },
  "dependencies": {
    "@aryxn/sdk-multichain": "workspace:*",
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
    // ... 其他依赖
  },
  "devDependencies": {
    "@types/react": "^19.2.8",
    "vite": "^7.3.1",
    "typescript": "~5.9.3"
  }
}
```

---

## 🔄 迁移步骤

### 第 1 步：创建新目录结构

```bash
# 创建新目录
mkdir -p apps/web
mkdir -p packages/{contracts-ethereum,contracts-solana,sdk-ethereum,sdk-solana,sdk-multichain}
```

### 第 2 步：移动现有代码

```bash
# 移动前端代码
mv client/* apps/web/

# 移动以太坊合约
mv contracts/src packages/contracts-ethereum/src
mv contracts/script packages/contracts-ethereum/script
mv contracts/test packages/contracts-ethereum/test
mv contracts/foundry.toml packages/contracts-ethereum/

# 移动 Solana 合约
mv contracts/solana/* packages/contracts-solana/

# 移动 SDK
mv contracts/sdk/* packages/sdk-multichain/src/
```

### 第 3 步：创建 package.json

```bash
# 为每个包创建 package.json（使用上面的模板）
```

### 第 4 步：更新导入路径

```typescript
// 前端代码中
// 之前: import { swap } from '@/lib/swap'
// 现在: import { MultiChainSwapper } from '@aryxn/sdk-multichain'

const swapper = new MultiChainSwapper({
  ethereum: {
    rpcUrl: "...",
    contractAddress: "...",
  },
  solana: {
    rpcUrl: "...",
    programId: "...",
  },
})
```

### 第 5 步：安装依赖

```bash
# 在根目录
pnpm install
```

---

## 🎨 前端集成示例

### apps/web/src/lib/swap/useSwap.ts

```typescript
import { useState } from "react"
import { MultiChainSwapper } from "@aryxn/sdk-multichain"

export function useSwap() {
  const [swapper] = useState(
    () =>
      new MultiChainSwapper({
        ethereum: {
          rpcUrl: import.meta.env.VITE_ETH_RPC_URL,
          contractAddress: import.meta.env.VITE_ETH_CONTRACT,
        },
        solana: {
          rpcUrl: import.meta.env.VITE_SOL_RPC_URL,
          programId: import.meta.env.VITE_SOL_PROGRAM,
        },
      }),
  )

  const executeSwap = async (params: SwapParams) => {
    // SDK 自动选择最优链
    return await swapper.swap(params)
  }

  return { executeSwap }
}
```

---

## ✅ 优势对比

### 当前结构 vs 新结构

| 维度         | 当前结构     | 新结构             |
| ------------ | ------------ | ------------------ |
| **组织性**   | 合约混在一起 | 按链分离           |
| **依赖管理** | 不清晰       | workspace 明确依赖 |
| **SDK 复用** | 无 SDK       | 独立 SDK 包        |
| **测试隔离** | 混合测试     | 各包独立测试       |
| **部署**     | 手动管理     | 脚本自动化         |
| **扩展性**   | 添加新链困难 | 添加新包即可       |
| **类型安全** | ABI 手动导入 | 自动生成类型       |

---

## 📊 最佳实践

### 1. 类型生成自动化

```json
// packages/contracts-ethereum/package.json
{
  "scripts": {
    "build": "forge build && pnpm generate:types",
    "generate:types": "typechain --target ethers-v6 --out-dir ../sdk-ethereum/src/types 'out/**/*.json'"
  }
}
```

### 2. CI/CD 流水线

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test-ethereum:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm --filter=@aryxn/contracts-ethereum test

  test-solana:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm --filter=@aryxn/contracts-solana test

  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm --filter=@aryxn/web test
```

### 3. 版本管理

使用 Changesets 管理版本：

```bash
pnpm add -Dw @changesets/cli
pnpm changeset init
```

---

## 📌 总结

新结构的核心优势：

✅ **清晰的职责边界** - 前端、合约、SDK 各司其职
✅ **易于维护** - 每个包独立开发、测试、部署
✅ **类型安全** - 合约 ABI 自动生成 TypeScript 类型
✅ **便于扩展** - 添加新链只需新增一个 package
✅ **团队协作** - 不同成员可专注不同包的开发

推荐按照这个结构重组，逐步迁移！
