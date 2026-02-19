# 上传支付路由重构（账户驱动 + 三层分流）

**日期**: 2026-02-19  
**状态**: ✅ 已完成（流程 + 实现 + 类型校验）

## 概述

本次改造聚焦上传页面支付链路，目标是让“支付账户选择 → 可选代币集合 → 支付路径分流”严格一致，并在需要跨链时统一接入 Swap 页面进行长流程处理（历史、刷新、恢复操作）。

## 流程整理（先行约定）

### 1) 支付账户选择（账户优先）

上传流程中，先选择用于支付费用的账户（链 + 地址），再根据账户链决定可选支付代币：

- Arweave 账户：仅 `AR`
- Ethereum 账户：`ETH`、`USDC`、`USDT`
- Solana 账户：`SOL`、`USDC`、`USDT`、`V2EX`

> 说明：上传所有权账户仍以 Arweave 上传账户为准；支付账户是“费用支付来源账户”，两者解耦。

### 2) 三层支付分流（执行阶段）

- Tier 1: `AR` → 直接原生支付（PAID_NATIVE）
- Tier 2: `ETH` / `SOL` / `USDC` → 走 Lyrs/Irys 快速支付（PAID_IRYS）
- Tier 3: 其他代币（如 `USDT`、`V2EX` 等）→ 标记为需要跨链兑换（REQUIRE_BRIDGE）

### 3) 跨链兑换交互（统一入口）

当返回 `REQUIRE_BRIDGE`：

- 上传流程不再直接外跳第三方站点
- 统一跳转 `Swap` 页面并默认切到 `Bridge` 标签
- 携带必要上下文（来源页面、支付代币、支付链、费用用途）

### 4) 跨链长流程能力（Swap 页）

Swap 页面继续承接：

- 历史记录（Transaction History）
- 状态刷新（Refresh）
- 恢复动作（Retry / Claim / Speed Up）

并对“从上传跳转来的桥接任务”做入口提示。

## 问题与解决方案

### 问题 A：上传支付选择未真正绑定到账户

- 现状：UI 存在地址选择，但执行支付使用的是 active evm/sol 地址。
- 方案：上传配置状态补充 `paymentAccount`（chain/address/isExternal），执行支付统一使用该账户。

### 问题 B：代币列表与业务规则不一致

- 现状：代币按 TOKEN_CONFIG 链聚类，不满足 ETH/SOL 指定组合，也缺少 `V2EX`。
- 方案：引入“按账户链映射代币”规则源，选择账户后动态约束代币列表。

### 问题 C：单文件桥接返回状态无法触发桥接弹窗/跳转

- 现状：单文件返回值只返回 boolean，`BRIDGE_REQUIRED` 分支失效。
- 方案：统一单文件/批量返回结构，显式上报 `status: BRIDGE_REQUIRED`。

### 问题 D：桥接入口未接入 Swap 内部流程

- 现状：桥接确认后直接打开外部 bridge 站点。
- 方案：改为路由跳转 `Swap`，由应用内桥接与历史能力承接。

## 配置变更总结

已修改文件：

- `apps/web/src/lib/payment/payment-service.ts`
- `apps/web/src/lib/payment/upload-payment-config.ts`
- `apps/web/src/lib/payment/types.ts`
- `apps/web/src/lib/payment/index.ts`
- `apps/web/src/lib/payment/README.md`
- `apps/web/src/lib/README.md`
- `apps/web/src/components/upload/PaymentTokenSelector.tsx`
- `apps/web/src/components/upload/UploadConfigurationCard.tsx`
- `apps/web/src/pages/Upload.tsx`
- `apps/web/src/hooks/upload-hooks/use-upload-handler.ts`
- `apps/web/src/components/upload/BridgeConfirmationDialog.tsx`
- `apps/web/src/components/upload/UploadExecutionCard.tsx`
- `apps/web/src/pages/Swap.tsx`
- `apps/web/src/components/swap/BridgeCard.tsx`
- `apps/web/src/hooks/swap-hooks/use-fee-calculation.ts`
- `apps/web/src/hooks/upload-hooks/index.ts`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/zh.json`
- `packages/chain-constants/src/tokens.ts`
- `packages/chain-constants/src/index.ts`

## 实施结果

### 已实现

- 新增统一配置入口（上传可选链、可选代币、路由判定）并在支付服务中集中维护，后续调整只需改一处。
- 将统一配置进一步拆分为独立模块：
	- `lib/payment/types.ts`（共享类型）
	- `lib/payment/upload-payment-config.ts`（上传支付配置与路由辅助）
	- `payment-service` 仅保留执行逻辑，便于后续维护与扩展。
- `Token configuration metadata` 已迁移到 `packages/chain-constants/src/tokens.ts`，并由 Web 侧直接复用，减少重复定义与漂移风险。
- 支付选择改为“账户优先、代币后选”，并把选择的支付账户透传到执行层。
- 按账户链约束代币：
	- Arweave: `AR`
	- Ethereum: `ETH` / `USDC` / `USDT`
	- Solana: `SOL` / `USDC` / `USDT` / `V2EX`
- 上传支付可选地址链改为：`SOL` / `ETH` / `SUI` / `AR`。
- 上传支付可选代币统一为：`USDT` / `USDC` / `ETH` / `SOL` / `SUI` / `AR` / `V2EX`。
- 三层分流在 `payment-service` 统一：
	- Tier 1: AR 原生支付
	- Tier 2: ETH / SOL / USDC 走 Irys
	- Tier 3: 其他按配置判定为 `REQUIRE_SWAP` 或 `REQUIRE_BRIDGE`
- 修复单文件上传桥接返回状态丢失问题，单文件/批量统一返回结构。
- 当触发 Swap/Bridge 时先弹统一确认提示，提示“跳转后可能需要重新上传”，用户确认后再跳转。
- 上传桥接确认后改为站内跳转 `Swap`（默认 `Bridge` 或 `Swap` 标签，带来源上下文），不再直接外跳第三方页面。
- `Swap/Bridge` 在 `source=upload` 场景下可自动预填来源 `token` 与可映射的来源链参数（若链不可映射则保留默认链）。
- 用户主动进入 Swap 页面时增加提示：需先根据账户管理选择账户与代币，再进行 swap/bridge 操作。
- 上传支付执行阶段新增“按所选支付账户解析钱包上下文”（外部 SOL/SUI/AR 钱包对象或内部 activeWallet），并在 Irys 执行前增加钱包前置校验，失败时返回明确错误而非静默失败。
- `lib/payment/README` 与 `lib/README` 已完成术语和 API 描述对齐，移除过时示例（如 `getTokenRate/convertAmount`）。

### 校验

- 类型检查通过：`pnpm --filter=@aryxn/web type-check`
- 类型检查通过：`pnpm --filter=@aryxn/chain-constants type-check`

## 测试建议

1. AR 账户 + AR 支付：应走 Native，上传可完成。
2. ETH 账户 + ETH/USDC 支付：应走 Irys，上传可完成。
3. SOL 账户 + SOL/USDC 支付：应走 Irys，上传可完成。
4. ETH/SOL 账户 + USDT/V2EX 支付：应返回桥接需求，并跳转 Swap Bridge。
5. Swap 中可看到历史记录并可触发刷新/恢复动作。

### 最小手动验收步骤（建议按顺序执行）

1. 进入 Upload，选择任意文件，确认“支付账户”下拉可选账户来自 AR/ETH/SOL 三链。
2. 选择 AR 账户，确认“支付代币”仅显示 `AR`，执行上传应直接进入上传流程。
3. 选择 ETH 账户，确认“支付代币”为 `ETH/USDC/USDT`：
	- 选 `ETH` 或 `USDC` 上传，应进入 Irys 支付并继续上传。
	- 选 `USDT` 上传，应弹出桥接确认。
4. 选择 SOL 账户，确认“支付代币”为 `SOL/USDC/USDT/V2EX`：
	- 选 `SOL` 或 `USDC` 上传，应进入 Irys 支付并继续上传。
	- 选 `USDT` 或 `V2EX` 上传，应弹出桥接确认。
5. 在桥接确认中点击继续，页面应跳转 `/swap?tab=bridge&source=upload...`，并默认打开 Bridge 标签。
6. 在 Swap 侧栏检查交易历史，可见记录并可进行刷新/恢复操作（Retry/Claim/Speed Up）。

## 相关资源

- `changelogs/2026-02-19-transaction-history-information-priority.md`
- `apps/web/src/components/swap/TransactionHistory.tsx`
- `apps/web/src/hooks/useBridge.ts`

## 上线前检查清单

### 发布前功能检查（必须）

- [ ] Upload 页面可正常选择支付账户（SOL / ETH / SUI / AR）
- [ ] Upload 页面可正常选择支付代币（USDT / USDC / ETH / SOL / SUI / AR / V2EX）
- [ ] AR + AR 路径走 `PAID_NATIVE`
- [ ] ETH/SOL + ETH/SOL/USDC 路径走 `PAID_IRYS`
- [ ] 其他组合触发 `REQUIRE_SWAP` 或 `REQUIRE_BRIDGE`
- [ ] 跳转前出现统一确认弹窗，且包含“可能需要重新上传”提示
- [ ] 跳转到 Swap 后默认标签与 action 参数一致（swap/bridge）
- [ ] 从 Upload 跳转到 Swap 后，来源提示可见（token/chain/source）
- [ ] Bridge 历史记录、刷新、恢复动作入口可见

### 发布前技术检查（必须）

- [ ] `pnpm --filter=@aryxn/web type-check` 通过
- [ ] `pnpm --filter=@aryxn/chain-constants type-check` 通过
- [ ] i18n 新增文案键在 `en/zh` 均存在
- [ ] `packages/chain-constants/src/tokens.ts` 与 Web 侧使用保持一致

### 钱包联调检查（建议）

- [ ] Phantom（Solana）连接/切换账号后支付路径正常
- [ ] Sui Wallet 连接/切换账号后支付路径正常
- [ ] EVM 外部钱包（MetaMask 等）签名与 Irys funding 正常
- [ ] 外部钱包断开场景提示明确，不出现静默失败

## 回滚清单

### 快速回滚策略

1. 回滚到本次改造前的 `Upload/Payment/Swap` 相关提交。
2. 保留数据库与用户数据，不执行数据结构回滚（本次主要为前端逻辑与配置改造）。
3. 回滚后执行：

```bash
pnpm --filter=@aryxn/web type-check
```

4. 重点验收：
	- Upload AR 直付可用
	- Swap 页面可正常打开与查看历史

### 受影响关键文件（回滚关注）

- `apps/web/src/hooks/upload-hooks/use-upload-handler.ts`
- `apps/web/src/components/upload/UploadExecutionCard.tsx`
- `apps/web/src/components/upload/BridgeConfirmationDialog.tsx`
- `apps/web/src/components/upload/PaymentTokenSelector.tsx`
- `apps/web/src/pages/Swap.tsx`
- `apps/web/src/lib/payment/payment-service.ts`
- `apps/web/src/lib/payment/upload-payment-config.ts`
- `packages/chain-constants/src/tokens.ts`
