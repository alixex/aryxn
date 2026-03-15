# Aryxn Packages

[English](./README.md) | [中文]

---

该目录存放 Aryxn 应用复用的共享领域模块与 SDK 层。

## 目录说明

- [arweave](./arweave)：Arweave 集成与上传/查询辅助能力。
- [chain-constants](./chain-constants)：共享链 ID、代币元数据与配置常量。
- [changelogs](./changelogs)：包级变更说明资产。
- [cross-chain](./cross-chain)：跨链桥接编排能力。
- [crypto](./crypto)：加密原语与编码工具。
- [exchange-chain](./exchange-chain)：兑换路径规划引擎。
- [query-chain](./query-chain)：多链数据查询抽象层。
- [storage](./storage)：本地/持久化存储辅助能力。
- [swap-ethereum](./swap-ethereum)：Ethereum 侧兑换执行适配。
- [swap-multichain](./swap-multichain)：多链兑换协调层。
- [swap-solana](./swap-solana)：Solana 侧兑换执行适配。
- [wallet-core](./wallet-core)：钱包核心生命周期、账户操作与签名抽象。

## 设计意图

- 将链无关能力做成可组合、可复用的 package。
- 通过稳定接口降低应用层耦合。
- 集中维护常量与协议元数据，避免配置漂移。

## 备注

- 多数 package 目录已有独立 README，包含更详细 API 与使用说明。
- 本文档作为 packages 目录入口与职责地图维护。
