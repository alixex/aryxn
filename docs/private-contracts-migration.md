# 私有合约迁移指南 (隐形模式)

本指南介绍如何将公开的合约包（packages）迁移到完全私有的仓库，并使 `contracts` 目录对公众**完全不可见**。

## 概览

我们将要把以下目录：

- `packages/contracts-ethereum`
- `packages/contracts-solana`

迁移到一个单一的私有仓库：

- `git@github.com:ranuts/contracts.git`

并将其配置为**本地开发可见，但在公开仓库中完全隐藏**。

## 机制说明

与 Submodule 不同，我们采用 `.gitignore` 模式：

1. `contracts` 目录（位于根目录）被添加到 `.gitignore`。
2. 公开仓库的用户拉取代码时，根本**不包含**这个目录。
3. 拥有权限的开发者（你）通过脚本手动将私有仓库 Clone 到该位置。

## 迁移步骤

### 1. 运行迁移脚本

我们更新了脚本来自动执行此过程：

```bash
./scripts/migrate-contracts.sh
```

脚本会自动：

- 将合约代码推送到私有仓库。
- 从本地删除旧目录。
- 修改 `.gitignore` 忽略 `contracts/`。
- 为你重新 Clone 私有仓库到 `contracts`。

### 2. 提交更改

迁移完成后，你需要提交 `.gitignore` 的更改：

```bash
git add .gitignore pnpm-workspace.yaml
git commit -m "Refactor: Move contracts to private repo (ignored)"
```

## 面向开发者的使用指南

### 对于新加入的有权限开发者

当你在新机器上设置开发环境时：

1. 克隆主仓库：
   ```bash
   git clone <主仓库 URL>
   cd aryxn
   ```
2. **手动拉取合约仓库**（因为它是被忽略的）：
   ```bash
   git clone git@github.com:ranuts/contracts.git contracts
   ```
3. 安装依赖：
   ```bash
   pnpm install
   ```

### 对于无权限的公开用户

他们只能克隆主仓库。`pnpm install` 会忽略缺失的 `contracts` 目录（只要 `pnpm-workspace.yaml` 配置正确）。他们无法看到也无法构建合约部分。
