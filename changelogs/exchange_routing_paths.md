# Arweave 存储支付的兑换路径说明

本文档详细说明了在 Aryxn 生态系统中，使用各种代币支付 Arweave 存储费的技术路由路径。

## 概览

Arweave 存储费采用多层支付体系。虽然 Arweave 原生使用 AR，但我们通过集成 **Irys (原 Bundlr)** 实现了主流资产的快速支付。如果某项资产 Irys 不直接支持，我们的 **Exchange SDK** 将提供必要的兑换/跨链路由，将其转换为支持的资产。

---

## 1. 快速支付路径 (Irys 直接充值)

这些资产由 Irys 网络直接支持，除非用户处于“错误”的链上，否则不需要中间兑换。

| 源代币   | 源链     | 目标服务    | 路径说明                                |
| :------- | :------- | :---------- | :-------------------------------------- |
| **AR**   | Arweave  | 原生 AR     | 直接在 Arweave 区块链上交易。           |
| **ETH**  | Ethereum | Irys (ETH)  | 使用 Ethereum L1 直接为 Irys 节点充值。 |
| **SOL**  | Solana   | Irys (SOL)  | 使用 Solana 直接为 Irys 节点充值。      |
| **SUI**  | Sui      | Irys (SUI)  | 使用 Sui 直接为 Irys 节点充值。         |
| **USDC** | Ethereum | Irys (USDC) | 使用 Ethereum 上的 USDC 直接充值。      |
| **USDC** | Solana   | Irys (USDC) | 使用 Solana 上的 USDC 直接充值。        |
| **USDT** | Ethereum | Irys (USDT) | 使用 Ethereum 上的 USDT 直接充值。      |

---

## 2. 集成兑换路径 (Exchange SDK + Irys)

当用户持有 Irys 不直接支持的资产（如 BTC 或 Solana 上的 USDT）时，Exchange SDK 会处理转换。

### 2.1 Bitcoin 链 (原生 BTC) 路径

由于 Irys 节点目前不直接支持原生 BTC 支付，用户需要通过 Exchange SDK 进行一次原子兑换：
| 步骤 | 动作 | 说明 |
| :--- | :--- | :--- |
| 1 | **Exchange SDK** | 将 **原生 BTC** 兑换为 **ETH (Ethereum)** 或 **USDC (Solana)** (底层使用 Thorchain 协议)。 |
| 2 | **Irys Service** | 使用接收到的 **ETH/USDC** 为 Irys 充值。 |
| 3 | **存储** | 将文件上传至 Arweave。 |

### 2.2 Solana 上的 USDT 路径 (特殊情况)

由于 Irys 原生支持 Solana 上的 USDC 但**不支持** USDT：
| 步骤 | 动作 | 说明 |
| :--- | :--- | :--- |
| 1 | **Exchange SDK** | 在 Solana 链内将 **USDT** 兑换为 **SOL** 或 **USDC**。 |
| 2 | **Irys Service** | 使用 **SOL/USDC (Solana)** 为 Irys 充值。 |
| 3 | **存储** | 将文件上传至 Arweave。 |

### 2.3 Sui 上的 USDT 和 USDC 路径

目前的 Irys 节点原生支持 Sui 链上的 SUI 代币，但暂不直接支持 Sui 上的 USDT/USDC 充值：
| 步骤 | 动作 | 说明 |
| :--- | :--- | :--- |
| 1 | **Exchange SDK** | 在 Sui 链内将 **USDT/USDC** 兑换为 **SUI**。 |
| 2 | **Irys Service** | 使用 **SUI** 为 Irys 充值。 |
| 3 | **存储** | 将文件上传至 Arweave。 |

### 2.4 跨链稳定币路径 (例如 Polygon 上的 USDC)

| 步骤 | 动作             | 说明                                                   |
| :--- | :--------------- | :----------------------------------------------------- |
| 1    | **Exchange SDK** | 将 **USDC (Polygon)** 跨链桥接至 **USDC (Ethereum)**。 |
| 2    | **Irys Service** | 使用 **USDC (Ethereum)** 为 Irys 充值。                |
| 3    | **存储**         | 将文件上传至 Arweave。                                 |

---

## 3. 评估总结

| 代币     | 状态     | 主要路由                    | 优化回退方案                     |
| :------- | :------- | :-------------------------- | :------------------------------- |
| **AR**   | 已支持   | 原生支付                    | 无                               |
| **ETH**  | 已支持   | Irys 快速支付               | 无                               |
| **SOL**  | 已支持   | Irys 快速支付               | 无                               |
| **SUI**  | 已支持   | Irys 快速支付               | 无                               |
| **USDT** | 已支持   | Irys 快速支付 (仅限 ETH 链) | 在 SOL 等链上自动兑换为 SOL/USDC |
| **USDC** | 已支持   | Irys 快速支付 (ETH/SOL 链)  | 在其他链上跨链至 ETH/SOL         |
| **BTC**  | 自动回退 | **兑换为 ETH**              | 通过 Exchange SDK 使用 Thorchain |

> [!NOTE]
> 对于以 **Arweave (AR)** 为兑换 _源_ 的场景（例如将 AR 换成 BTC），由于 LIFI 目前不支持 Arweave，该路径暂不可用。建议用户保留 AR 用于原生存储，或通过外部交易所进行 AR 到其他代币的转换。
