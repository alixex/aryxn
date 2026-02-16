# Changelog - 2024-12-19

## 概述

本次更新主要解决了 Vite 开发环境下的依赖优化问题、React hooks 错误、Base Account SDK 冲突以及 SQLite WASM API 使用错误。

## 问题与解决方案

### 1. Vite 依赖优化错误 (504 Outdated Optimize Dep)

**问题描述：**

```
Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep)
```

**原因：**

- Vite 的依赖缓存过期
- React 相关依赖未正确包含在 `optimizeDeps` 中

**解决方案：**

- 清除 Vite 缓存：`rm -rf node_modules/.vite`
- 在 `vite.config.ts` 的 `optimizeDeps.include` 中添加：
  ```typescript
  include: [
    "@metamask/sdk",
    "@rainbow-me/rainbowkit",
    "wagmi",
    "viem",
    "react",
    "react-dom",
    "react/jsx-runtime",
  ]
  ```
- 移除了 `@metamask/sdk` 的别名配置（让 Vite 自动处理）

**文件修改：**

- `vite.config.ts`

---

### 2. React Hooks 错误 (Invalid hook call)

**问题描述：**

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
Cannot read properties of null (reading 'useState')
```

**原因：**

- React 未正确包含在 Vite 的依赖优化中
- 可能存在多个 React 实例

**解决方案：**

- 将 React 相关包添加到 `optimizeDeps.include`
- 确保只有一个 React 实例

**文件修改：**

- `vite.config.ts`

---

### 3. Base Account SDK 与 SQLite OPFS 的 COOP 冲突

**问题描述：**

```
Base Account SDK requires the Cross-Origin-Opener-Policy header to not be set to 'same-origin'.
```

**原因：**

- Base Account SDK 需要 `COOP` 不能是 `same-origin`（需要允许弹出窗口）
- SQLite OPFS 需要跨源隔离（`COOP: same-origin` + `COEP: require-corp`）
- 两者存在冲突

**解决方案：**

- 使用 `COOP: same-origin-allow-popups` 替代 `same-origin`
- `same-origin-allow-popups` 仍然提供跨源隔离（满足 SQLite OPFS）
- 同时允许弹出窗口（满足 Base Account SDK）
- 移除了 Base 链配置（虽然不使用，但 RainbowKit 可能自动启用 Base Account SDK）

**文件修改：**

- `vite.config.ts` - 更新开发服务器 headers
- `public/coi-serviceworker.min.js` - 更新 service worker 的 COOP 设置
- `src/providers.tsx` - 移除 Base 链配置

**注意：**

- Base Account SDK 的警告可以忽略（不影响功能）
- 如果不需要 Base Account SDK，可以继续使用 `same-origin`，但会有警告

---

### 4. SQLite WASM API 使用错误

**问题描述：**

```
Unknown db worker message type: prepare
```

**原因：**

- SQLite WASM worker 不支持 `prepare`、`bind`、`step` 等操作
- 只支持 `exec` 操作

**解决方案：**

- 重写 `executeStatement` 函数，使用 `exec` API 替代 prepared statements
- 添加参数转义函数 `escapeSqlString` 来防止 SQL 注入
- 手动替换 SQL 中的 `?` 占位符为转义后的值

**文件修改：**

- `src/lib/sqlite-db.ts` - 完全重写 `executeStatement` 函数

**代码变更：**

```typescript
// 之前：使用 prepare/bind/step API（不支持）
const prepareResult = await dbPromiser("prepare", { dbId, sql })
// ...

// 之后：使用 exec API
const result = await dbPromiser("exec", {
  dbId,
  sql: finalSql, // 手动替换参数后的 SQL
  returnValue: mode !== "run" ? "resultRows" : undefined,
  rowMode: mode !== "run" ? "object" : undefined,
})
```

---

### 5. 数据库初始化错误处理改进

**问题描述：**

- 数据库初始化时缺少错误检查
- 并发初始化可能导致竞态条件

**解决方案：**

- 添加 `initPromise` 防止并发初始化
- 改进错误检查，检查所有 SQLite worker 响应的 `type` 字段
- 初始化失败时清理状态
- 改进表创建的错误处理

**文件修改：**

- `src/lib/sqlite-db.ts` - 改进 `initDatabase` 和 `createTables` 函数

---

### 6. 钱包创建 API 错误修复

**问题描述：**

```
TypeError: Cannot read properties of undefined (reading 'add')
```

**原因：**

- `createWallet` 函数错误使用了 `db.wallets.add()`（Dexie API）
- 应该使用 SQLite 的 `db.run()` 方法

**解决方案：**

- 将 `db.wallets.add()` 改为 `db.run()` 和 SQL INSERT 语句
- 与 `addWallet` 函数保持一致

**文件修改：**

- `src/providers/wallet-provider.tsx`

---

## 配置变更总结

### vite.config.ts

- ✅ 添加 React 相关依赖到 `optimizeDeps.include`
- ✅ 移除 `@metamask/sdk` 别名
- ✅ 更新 `COOP` 为 `same-origin-allow-popups`

### public/coi-serviceworker.min.js

- ✅ 更新 `COOP` 为 `same-origin-allow-popups`

### src/providers.tsx

- ✅ 移除 Base 链配置

### src/lib/sqlite-db.ts

- ✅ 重写 `executeStatement` 使用 `exec` API
- ✅ 添加参数转义函数
- ✅ 改进错误处理和并发控制

### src/providers/wallet-provider.tsx

- ✅ 修复 `createWallet` 使用正确的 SQL API

---

## 测试建议

1. **清除缓存并重启：**

   ```bash
   rm -rf node_modules/.vite
   pnpm dev
   ```

2. **验证功能：**
   - ✅ 应用正常启动，无 React hooks 错误
   - ✅ 数据库初始化成功（检查控制台日志）
   - ✅ 钱包创建功能正常
   - ✅ SQLite 数据持久化（刷新页面数据保留）
   - ✅ Base Account SDK 警告可以忽略

---

## 相关资源

- [SQLite WASM 文档](https://sqlite.org/wasm/doc/trunk/index.md)
- [Base Account SDK 文档](https://docs.base.org/smart-wallet/quickstart#cross-origin-opener-policy)
- [Vite 依赖优化](https://vitejs.dev/guide/dep-pre-bundling.html)
- [Cross-Origin Isolation](https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated)

---

## 备注

- Base Account SDK 的警告不影响功能，可以安全忽略
- SQLite 现在使用 `exec` API，虽然不如 prepared statements 安全，但通过参数转义可以防止 SQL 注入
- `same-origin-allow-popups` 仍然提供跨源隔离，SQLite OPFS 可以正常工作
