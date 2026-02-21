# 2026-02-19 Bitcoin Native Support Plan

## Goal

在 Aryxn 交换页实现“真 BTC”能力（不是 WBTC 代替）：

1. BTC 账户可进行原生 BTC 发送（UTXO + 签名 + 广播）
2. 历史记录可记录 BTC 发送
3. 不再把 Bitcoin 账户伪装为 EVM/WBTC 路径

## Current Status (Before This Change)

- 已有能力：
  - BTC 账户创建/导入（WIF）
  - BTC 余额查询
  - BTC 链上历史聚合查询
- 缺失能力：
  - BTC 原生交易构建与签名
  - BTC 广播链路
  - 交换页中 BTC 专用发送交互
- 已发现问题：
  - `DexTokenSymbolsByAccountChain[bitcoin] = ["WBTC"]` 语义错误，会误导为 EVM 资产

## Execution Phases

### Phase 1 (Start Now): Native BTC Send (Internal Wallet)

- 新增 BTC 交易签名能力（Taproot key path，WIF 私钥）
- 新增 BTC 发送链路（UTXO 拉取、费率估算、找零、广播）
- 在发送页新增 BTC 模式（选中 BTC 账户时显示原生 BTC 发送流程）
- 历史记录写入 SEND/BTC 记录
- 移除 `bitcoin -> WBTC` 的 DEX 代币映射

### Phase 2: UX Hardening

- 明确区分 BTC 原生发送 与 EVM Token 发送
- 同步按钮和错误提示细化（低余额、UTXO 不足、手续费过高等）
- 增加 BTC 发送确认信息（fee/vsize/change）

### Phase 3: Extended Capabilities

- 外部 BTC 钱包接入
- BTC 跨链桥接/交换（若引入可用路由）
- 更丰富的 UTXO 选择策略与 RBF 支持

## Technical Design (Phase 1)

- `@aryxn/crypto`
  - 新增 BTC 交易构建/签名方法（输入 WIF、UTXO、金额、fee）
- `apps/web`
  - 新增 BTC 网络交互模块（UTXO/fee/broadcast）
  - 新增 `useBitcoinTransfer` hook
  - `TransferCard` 按账户链分流：EVM path / BTC native path
- `packages/chain-constants`
  - 删除 Bitcoin -> WBTC 映射，避免错误路线

## Risks and Constraints

- 首版只支持内部 BTC 钱包（WIF）
- 首版仅实现 BTC 发送，不实现 BTC 原生 swap
- 使用 Blockstream API，受网络可用性影响

## Verification Checklist

- TypeScript type-check 通过
- BTC 模式下可创建并广播交易（本地/测试环境）
- 历史列表正确显示 BTC SEND
- 非 BTC 模式行为不回归

## Implementation Started

当前会先交付 Phase 1 的最小可用版本。
