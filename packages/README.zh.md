# Aryxn Packages

[English](./README.md) | [中文]

---

该目录存放 Aryxn 应用复用的共享领域模块。

## 目录说明

- [arweave](./arweave)（`@alixex/arweave`）：Arweave 上传、费用估算、（解）压缩，以及 GraphQL 搜索 + 缓存。
- [crypto](./crypto)（`@alixex/crypto`）：对称加密（libsodium XChaCha20-Poly1305）、编码辅助，以及 PBKDF2 密钥派生。
- [storage](./storage)（`@alixex/storage`）：加密的 `localStorage` 缓存与 IndexedDB 键值辅助。
- [changelogs](./changelogs)：包级变更说明资产。

## 设计意图

- 将链无关能力做成可组合、可复用的 package。
- 通过稳定接口降低应用层耦合。
- 链（Arweave / Irys）是唯一事实来源；`storage` 只是本地缓存。

## 备注

- `arweave`、`crypto`、`storage` 均有独立 README，包含更详细的 API 与使用说明。
- 本文档作为 packages 目录入口与职责地图维护。
