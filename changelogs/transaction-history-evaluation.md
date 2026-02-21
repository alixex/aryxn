# Transaction History Sync & Storage Evaluation

## 需求分析与现状评估

从代码来看，你提到的三个需求（保存到 SQLite、提供手动更新同步按钮、按地址筛选）在目前架构中的现状非常有利于快速实现：

### 1. 存储底层 (SQLite + @aryxn/storage)
**现状**: 
- 目前应用已经使用了 `@aryxn/storage` 包（底层是基于 OPFS 优化的 WebAssembly SQLite `@sqlite.org/sqlite-wasm` ）。
- 桥接/交换的交易记录实质上已经被存入了 SQLite 数据库的 `bridge_transactions` 表中（位于 `apps/web/src/lib/store/bridge-history-repo.ts` ）。
- 这种方案极其适合在客户端存放成千上万条记录进行超高效率的索引和查询。

**改进空间 (加密存储)**:
- 目前 `bridge_transactions` 的数据是明文存在 SQLite 里的。如果是隐私敏感数据（比如交易金额、来源地址），我们需要在写入前利用已存在的 `@aryxn/crypto` 对敏感列（如 `amount`, `token`）进行对称加密。这也是一个极佳的安全实践。

### 2. 手动同步与自动防抖
**现状**:
- 历史记录组件 `<TransactionHistory />` 中已经实现了手动刷新按钮（"Sync"）。
- 它通过 `syncWithChain` 方法从后端索引节点（通过 `@aryxn/query-chain` 里的 `AggregateHistoryProvider`）按需拉取数据落库。
- 自带了 30s 的 Cooldown，避免了高频垃圾请求。

**改进空间**:
- 此处的逻辑非常完善，基本上不需要重新设计，只需确保 UI 上按钮的交互明确即可。

### 3. 数据查询与筛选 (Filter)
**现状**:
- 目前只有按交易类型的本地内存过滤（`ALL`, `SWAP`, `BRIDGE`, `SEND`）。

**改进空间 (按地址筛选)**:
- **UI 侧**: 需要在查询栏添加一个以钱包地址为筛选条件的下拉框或输入框。
- **存储侧 (SQLite 优化)**: 从长远看（大数据量），不应该把所有记录加载到内存后再过滤。我们应该修改 `listBridgeTransactions` 这个查询语句，将 `address` 作为 `WHERE` 参数传入 SQLite，利用索引实现毫秒级的响应。

## 综合工作量预估与路线图

该任务属于典型的**基于现有成熟框架的功能迭代**。

### Phase 1: 存储层增强（加密支持）
**预测耗时:** 低 (Low)
1. 在 `bridge-history-repo.ts` 中引入 `@aryxn/crypto`。
2. 在 `upsertBridgeTransaction` 时，对 `amount`、`token` 以及未来可能会有的 `sender` 字段做对称加密后再存入 SQLite。
3. 在 `listBridgeTransactions` 读取后自动解密还原。

### Phase 2: 后端查询增强（数据库层）
**预测耗时:** 低 (Low)
1. 扩展 `listBridgeTransactions(limit, filters?: { type?, address? })`。
2. 动态拼接 SQLite 的 `WHERE` 语句。

### Phase 3: 前端组件交互增强
**预测耗时:** 中等 (Medium)
1. 在 `TransactionHistory.tsx` 现有 tab 过滤的上方增加一个账户地址筛选器（复用跨链常用的下拉框）。
2. 将本地数组 filter 替换为调用更新库的数据重新加载逻辑。

## 结论
现有架构（基于 OPFS 的本地 SQLite + 按需 Sync）已经非常完美地匹配了你应对大数据和高效查询的期望。我们可以直接开始在此基础上增加“列级加密”和“下推给数据库的地址搜索”功能。
