# 技术实现方案：方案一 (多币种兑换与桥接支付)

本文档记录了 Aryxn 在处理非 AR 代币支付存储费用时的核心流程（方案一）。

## 核心流程示意

```mermaid
graph TD
    A[用户选择 ETH/USDC/USDT] --> B[评估 Arweave 存储费用]
    B --> C[计算所需 AR 数量]
    C --> D[调用 EthereumSwapper 执行兑换]
    D --> E[获得 Ethereum 上的 WAR (Wrapped AR)]
    E --> F[触发跨链桥 Bridge 指令]
    F --> G[AR 到达 Arweave 网络]
    G --> H[执行最终数据上传]
```

## 实施详情

### 1. 自动兑换逻辑
- **触发点**：在 `Upload.tsx` 确认上传时，若 `paymentToken !== "AR"`，进入 `paymentStage`。
- **SDK 交互**：使用 `@aryxn/sdk-multichain` 获取 `tokenIn -> WAR` 的最优路径报价。
- **合约执行**：通过 `UniversalRouter` 合约执行 swap 操作，将用户代币转换为 WAR。

### 2. 桥接集成 (Bridge)
- **目标合约**：WAR 合约提供的 `burn` 或特定的 Bridge 合约的 `bridgeOut` 方法。
- **跨链确认**：监听以太坊确认后，在 Arweave 端等待余额同步（可能存在 10-20 分钟延迟，后续需优化为即时结算或托管池模式）。

### 3. UI 反馈
- 增加提示： "正在兑换并桥接代币，这可能需要一点时间..."
- 进度条需涵盖：`Swap -> Bridge Confirmation -> Upload` 三个阶段。

## 技术栈更新
- **前端 SDK**：`@aryxn/sdk-multichain` (v1.1.0)
- **合约接口**：`UniversalRouter.sol`
- **代币地址**：`0x4fadc7a98f2dc96510e42dd1a74141eeae0c1543` (Ethereum WAR)

## 方案对比：方案一 vs. Irys (原 Bundlr)

为了更好地指导后续开发迭代，以下是原生支付方案（方案一）与使用 Irys 聚合服务的对比：

### 1. 对比概览

| 特性 | 方案一 (Swap + Bridge) | Irys 方案 (Optimistic) |
| :--- | :--- | :--- |
| **支付币种** | 需兑换为 AR/WAR | 直接支付 ETH/SOL/USDC 等 |
| **完成时间** | **较慢 (10-20 分钟)** | **极快 (< 1 分钟)** |
| **技术路径** | 兑换 -> 跨链确认 -> 支付 | 支付 -> 获得签名收据 -> 逻辑上传 |
| **链支持** | ETH, SOL (通过 Swap) | ETH, SOL (原生支持) |
| **BTC 支持** | 需先兑换为 WBTC/ETH | 暂不支持原生 BTC |

### 2. 深度分析

#### 为什么 Irys 不用等跨链确认？
Irys 采用了 **“乐观终局性” (Optimistic Finality)** 机制。它在 Arweave 之上构建了一个 L2 节点层，用户支付给 Irys 节点后，节点会立即签发一份带加密签名的收据。Arweave 网关信任该收据并允许即时访问数据，而真正的底层 L1 结算由 Irys 节点在后台批量异步完成。

#### 时间影响
- **方案一**：跨链桥（Bridge）通常需要等待以太坊 6-12 个区块确认，处理时间平均在 15 分钟左右，用户体验存在断层。
- **Irys**：支付确认即上传确认，用户只需等待一次原链交易打包时间（~15s），体验流畅。

#### 风险评估
- **跨链失败**：方案一若桥接失败，用户资产可能卡在 WAR 状态，需手动干预退款。
- **集成风险**：Irys 属于中心化程度较高的聚合层，方案一则是完全去中心化的 L1 原子操作。

---
*注：本项目目前已完成方案一的 Swap 逻辑打通，后续可透明迁移至 Irys 方案以实现秒级上传体验。*
