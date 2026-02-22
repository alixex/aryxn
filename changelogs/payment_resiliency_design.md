# 技术设计文档：静默存储支付与韧性恢复系统 (Silent Payment & Resiliency)

## 1. 背景与目标

为了提升 Aryxn 处理大文件上传时的支付体验，特别是在涉及多链兑换（Swap/Bridge）等长耗时操作时，我们需要一套能够“原地处理”且“具备恢复能力”的系统。

**核心目标：**

- **消除跳转**：在上传页面完成所有支付逻辑，避免丢失大文件上传上下文。
- **韧性恢复**：能够处理网络中断、页面刷新、浏览器关闭等意外情况。
- **透明反馈**：针对不同的支付阶段和耗时，提供分级且清晰的用户反馈。
- **杜绝重付**：基于链上状态和账户余额实现支付幂等性。

---

## 2. 核心架构设计

### 2.1 分级处理策略 (Tiered Processing)

根据 `ExchangeRouter` 返回的 `estimatedTime`，系统采取不同的处理路径：

| 耗时等级          | 预估时间   | 处理方式     | UI 表现                                      |
| :---------------- | :--------- | :----------- | :------------------------------------------- |
| **极速 (Fast)**   | < 1 min    | 自动背景执行 | 按钮文字变为“支付准备中...”，完成后自动上传  |
| **等待 (Medium)** | 1 - 10 min | 原位模态框   | 弹出进度模态框，保持页面并显示步骤进度       |
| **长期 (Slow)**   | > 10 min   | 警告与持久化 | 弹出风险提示，建议用户保持页面或告知如何恢复 |

### 2.2 数据持久化：`upload_payment_intents`

使用 `packages/storage` 中的 SQLite (OPFS) 替代 `localStorage`。

**Schema 描述：**

```sql
CREATE TABLE IF NOT EXISTS upload_payment_intents (
  id TEXT PRIMARY KEY,           -- UUID: 标识本次上传 session
  tx_hash TEXT,                  -- 交易哈希 (可为空，直到交易发出)
  from_chain TEXT NOT NULL,      -- 源链 (如: bitcoin, ethereum)
  from_token TEXT NOT NULL,      -- 源代币 (如: BTC, USDT)
  to_token TEXT NOT NULL,        -- 目标代币 (通常是 Irys 支持的代币)
  ar_address TEXT NOT NULL,      -- 接收文件的 Arweave 地址
  file_metadata TEXT,            -- 存储文件名和大小的 JSON
  status TEXT NOT NULL,          -- INITIATED, PENDING, COMPLETED, FAILED
  payment_type TEXT NOT NULL,    -- SWAP, BRIDGE, DIRECT
  target_balance_type TEXT,      -- 资金沉积点: IRYS, WALLET, ARWEAVE
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

---

## 3. 业务逻辑流程

### 3.1 支付执行流程 (Execution Flow)

1. **预检 (Pre-flight)**：检查 Irys 余额或目标代币余额。若足够，直接跳到步骤 4。
2. **意图记录 (Intent Log)**：在数据库创建状态为 `INITIATED` 的记录。
3. **分级执行**：
   - 启动 Swap/Bridge。
   - 获取 `txHash` 后，立即更新数据库记录为 `PENDING` 并存入 `txHash`。
4. **状态同步 (Sync)**：
   - 使用 `BridgeStatusTracker` 定期轮询链上状态。
   - 确认到账后，更新状态为 `COMPLETED`。
5. **触发上传**：状态变为 `COMPLETED` 后回调上传组件开始 Data Upload。

### 3.2 恢复方案 (Recovery Flow)

当用户刷新页面并重回 `Upload.tsx` 时：

1. **挂起意图检索**：自动查询数据库中是否存在 `status = 'PENDING'` 或 `status = 'INITIATED'` 且 `updated_at` 在 24 小时内的记录。
2. **状态自动对齐**：
   - **Case A: 钱已在 Irys**：提示“检测到已付信用”，直接显示“点击上传”。
   - **Case B: 钱在钱包 (Swap 后)**：提示“检测到就绪资金”，请求用户签署 Irys Funding 交易。
   - **Case C: 交易进行中**：显示进度条，继续等待链上确认。
3. **过期清理**：超过 24 小时的未完成意图将被标记为已过期或转入历史记录。

---

## 4. 交互设计 (UX Strategy)

### 4.1 支付前置告知 (Pre-payment Transparency)

在用户点击“支付”按钮前，根据选择的路径显示动态提示，管理用户预期：

- **同链场景**：显示 `“支付约需 30 秒，完成后将自动开始上传。”`
- **跨链场景 (L2/SOL)**：显示 `“此兑换涉及跨链，预计耗时 5-10 分钟。您可以留在本页等待，或在发起后关闭网页（系统会在后台自动完成信用充值）。”`
- **BTC 场景**：显示 `“⚠️ 检测到 BTC 支付：预计确认时间需 30-60 分钟。支付发起后，您的资金将安全进入 Irys 账户，您可随时回来完成最后的文件提交。”`

### 4.2 术语映射

- **Irys 余额** -> **“存储信用 (Storage Credit)”**
- **钱包内代币** -> **“就绪资金 (Ready Funds)”**
- **跨链进行中** -> **“资金调拨中 (Allocating Funds)”**

### 4.3 通知机制 (Notifications)

- **全局 Toast (Sonner)**：
  - `[进行中]`：“正在为您准备 0.05 SOL 存储信用...”
  - `[成功]`：“信用已充值，正在启动加密上传。”
- **上下文 UI**：
  - 在 `FeeEstimate` 底部增加一个微型状态条，用于显示异步支付的当前步骤。

---

## 5. 实现阶段划分

### 第一阶段：基础设施 (Infrastructure)

- 修改 `@aryxn/storage` 的 Schema 注册机制。
- 实现 `PaymentRepository` 用于操作 `upload_payment_intents` 表。

### 第二阶段：核心 Service 更新 (Core Services)

- 扩展 `PaymentService.executePayment` 支持静默模式和进度回调。
- 注入 `ExchangeRouter` 逻辑到 `PaymentService`。

### 第三阶段：UI 联动 (UI Integration)

- 升级 `useUploadHandler` 钩子，使其具备“恢复”感知能力。
- 升级 `UploadExecutionCard.tsx` 的进度展示逻辑。

### 第四阶段：测试验证 (Verification)

- 模拟各种中断场景（网络离线、刷新、换号）进行容错测试。
