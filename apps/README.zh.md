# Aryxn Apps

[English](./README.md) | [中文]

---

该目录存放 Aryxn monorepo 中面向用户的应用。

## 目录说明

- [vault](./vault)：主 Web 应用，覆盖账户管理、上传、仪表板、搜索与设置流程。

## 应用职责

### vault

- 基于 React + Vite 的终端用户界面
- 多链账户与钱包操作
- 上传与加密永久存储流程
- 搜索、交易历史与仪表板体验
- 设置、国际化与运行时配置

## 相关文档

- [Vault README (EN)](./vault/README.md)
- [Vault README (ZH)](./vault/README.zh.md)

## 约定

- 应用级文档放在各应用目录内。
- 可复用业务能力放在 `packages/`，避免堆积在应用层。
- `apps/README.md` 作为目录入口和职责地图维护。
