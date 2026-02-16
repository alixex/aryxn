# 系统架构

## 概述

Aryxn 是一个用户主权优先的保险库应用，集成了 DEX 功能。它构建为本地优先的应用程序，使用 SQLite WASM 进行高性能的本地数据管理，并使用 Arweave 进行永久的、去中心化的存储。

## 核心组件

### 1. 客户端应用 (`apps/web`)

前端是一个使用 Vite 构建的 React 应用程序。它作为用户管理文件、账户和交易的主要界面。

- **存储**: 使用 **SQLite WASM** 作为强大的基于 SQL 的本地数据库。这允许在浏览器中直接进行复杂的查询、全文搜索和高效的数据管理。
- **持久化**: 数据通过 Origin Private File System (OPFS) 在本地持久化。
- **样式**: 使用基于 Tailwind CSS 和 shadcn/ui 的单色设计系统。

### 2. 智能合约与区块链集成 (`packages/contracts-*`)

系统集成了多个区块链用于资产管理和交易。

- **Ethereum**: 用于原子交换和资产管理的智能合约。
- **Solana**: 基于 Anchor 的 Solana 原子交换程序。
- **Arweave**: 用于永久文件存储和去中心化数据同步。

### 3. SDK 层 (`packages/sdk-*`)

统一的 SDK 层抽象了区块链交互，为前端提供一致的 API。

- **`@aryxn/sdk-ethereum`**: 用于与以太坊合约交互的 TypeScript SDK。
- **`@aryxn/sdk-solana`**: 用于与 Solana 程序交互的 TypeScript SDK。
- **`@aryxn/sdk-multichain`**: 一个统一的封装器，将请求路由到相应的特定链 SDK。

## 数据同步

本地设备与去中心化网络之间的数据同步通过 **清单机制 (Manifest Mechanism)** 处理。

- **本地优先**: 所有写入首先在本地 SQLite 中发生。
- **同步到 Arweave**: 后台进程使用版本化清单系统将本地更改同步到 Arweave。
- **增量更新**: 仅上传更改（增量）以最小化数据传输和存储成本。

详见 [数据同步与清单](./data-sync.md)。

## 项目结构

项目遵循由 `pnpm` 管理的 Monorepo 结构。

详见 [项目结构](./project-structure.md) 了解详细的目录布局和模块组织。
