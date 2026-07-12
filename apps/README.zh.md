# Aryxn Apps

[English](./README.md) | [中文]

---

该目录存放 Aryxn monorepo 中面向用户的应用。

## 目录说明

- [link](./link)：Aryxn Web 应用——上传文件，获得一条 Arweave 或 Irys 上的永久链接。

## 应用职责

### link（`@alixex/link`）

- 无框架 SPA，基于 **ranui**（Geist 设计系统）、TypeScript 与 Vite 构建
- 面向 **Arweave** 与 **Irys** 的上传流程，支持可选的客户端加密
- 账户管理：本地加密 Arweave keyfile、外部 **Wander** 钱包，以及用于为 Irys 付费的 **EVM** 钱包（EIP-6963）
- 对自己链接的本地历史与搜索；双语（en / zh）与 系统 / 浅色 / 深色 主题

## 约定

- 应用级文档放在各应用目录内。
- 可复用业务能力放在 `packages/`，避免堆积在应用层。
- `apps/README.md` 作为目录入口和职责地图维护。
