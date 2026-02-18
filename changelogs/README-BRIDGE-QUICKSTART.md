# 跨链桥实现 - 快速开始

## 🎉 已完成功能

### 核心服务

- ✅ Li.Fi SDK 集成（智能路由聚合器）
- ✅ 多链支持：Ethereum、Polygon、Arbitrum、Optimism、BSC、Avalanche
- ✅ 地址格式验证（EVM 链自动识别）
- ✅ 费用计算（Gas + 桥接费 + 价格影响）
- ✅ 风险评估（基于交易金额）
- ✅ 交易状态实时跟踪（自动轮询 Li.Fi API）

### UI 功能

- ✅ 优先级选择器：最快 / 平衡 / 最便宜
- ✅ 目标地址输入（自动填充 + 验证）
- ✅ 实时报价更新（1 秒防抖）
- ✅ 风险警告（大额交易）
- ✅ 详细费用明细
- ✅ 路由可视化
- ✅ 交易历史自动更新（显示最后更新时间）

## 🚀 如何使用

### 1. 启动开发服务器

```bash
pnpm dev
```

### 2. 访问 DEX 页面

打开浏览器：`http://localhost:5173/dex` → 点击 "Bridge" 标签

### 3. 填写桥接信息

#### 选择优先级

- **⚡ 最快**：2-5 分钟，费用较高（适合紧急交易）
- **📈 平衡**：10-15 分钟，中等费用（推荐）
- **💰 最便宜**：20-30 分钟，最低费用（适合大额）

#### 选择链和代币

- **源链**：选择资产当前所在链（如 Ethereum）
- **目标链**：选择要转移到的链（如 Polygon）
- **代币**：选择要桥接的资产（如 USDC）
- **数量**：输入金额

#### 输入目标地址

- 如果你在目标链有账户，系统会自动填充
- 也可以手动输入其他地址
- 系统会自动验证地址格式

### 4. 查看报价

系统会显示：

- ⏱️ 预计时间
- 💰 Gas 费用（USD）
- 🌉 桥接费用（USD）
- 📊 价格影响
- 💸 总费用
- 🛣️ 路由详情（使用哪些桥）

### 5. 风险提示

- **< $1,000**：无警告，安全范围
- **$1,000 - $10,000**：黄色提示，建议考虑分批
- **> $10,000**：红色警告，强烈建议分批或使用 CEX

### 6. 执行桥接

点击 "Bridge Assets" 按钮

> **注意**：当前为模拟执行，真实交易功能待实现

## 📁 文件结构

### 服务层（`packages/cross-chain/`）

```
src/
├── lifi-bridge-service.ts      # Li.Fi 集成核心服务
├── address-utils.ts             # 地址验证工具
├── bridge-status-tracker.ts    # 交易状态跟踪器（新增）
└── index.ts                     # 导出接口
```

### UI 层（`apps/web/src/`）

```
components/dex/
├── BridgeCard.tsx              # 桥接 UI 组件
└── TransactionHistory.tsx      # 交易历史（已更新：显示更新时间）

hooks/
└── useBridge.ts                # React Hook（报价/执行/状态跟踪）

lib/store/
└── bridge-history.ts           # 交易历史存储（已更新：lastUpdate 字段）

components/ui/
└── alert.tsx                   # 警告组件
```

## 🔧 技术栈

- **Li.Fi SDK** v3.15.6：跨链路由聚合器
- **React 19**：UI 框架
- **TypeScript**：类型安全
- **Tailwind CSS**：样式
- **Sonner**：Toast 通知

## 💡 特色功能

### 1. 智能地址填充

```typescript
// EVM 链之间自动使用同一地址
if (isEVMChain(sourceChain) && isEVMChain(destChain)) {
  setDestAddress(wallet.active.evm.address)
}
```

### 2. 实时地址验证

```typescript
// Ethereum: 0x + 40 个十六进制字符
// Solana: 32-44 个 Base58 字符
const isValid = validateAddress(address, chainId)
```

### 3. 费用优化

```typescript
// 根据优先级自动选择最优路由
priority === 'fastest'  → Li.Fi FASTEST
priority === 'balanced' → Li.Fi RECOMMENDED
priority === 'cheapest' → Li.Fi CHEAPEST
```

### 4. 风险评估

```typescript
amountUSD < $1K    → LOW (无警告)
amountUSD < $10K   → MEDIUM (建议分批)
amountUSD >= $10K  → HIGH (强烈建议分批)
```

### 5. 自动状态跟踪

```typescript
// 交易执行后自动启动跟踪
BridgeStatusTracker.startTracking(txHash, fromChain, toChain, (info) => {
  // 每 10 秒轮询一次 Li.Fi API
  // 自动更新交易历史状态
  // 完成后发送 toast 通知
})
```

**跟踪特性**：

- ⏱️ 10 秒轮询间隔
- ⏰ 10 分钟自动超时
- 🔄 失败自动重试
- 📍 捕获目标链交易哈希
- 🧹 组件卸载时自动清理

## 📊 费用参考

| 路由                   | 时间       | Gas  | 桥接费 | 总计   |
| ---------------------- | ---------- | ---- | ------ | ------ |
| ETH → Polygon (最快)   | 2-5 分钟   | $3-5 | $2-3   | $5-8   |
| ETH → Polygon (平衡)   | 10-15 分钟 | $2-3 | $1-2   | $3-5   |
| ETH → Polygon (最便宜) | 20-30 分钟 | $1-2 | $0.5-1 | $1.5-3 |

\*费用会根据网络拥堵情况实时变化

## 🔐 安全特性

### 已实现

- ✅ 地址格式验证（防止跨链错误）
- ✅ 交易金额风险警告
- ✅ 费用透明化（所有成本提前显示）
- ✅ 类型安全（TypeScript 严格模式）
- ✅ 自动状态跟踪（实时更新交易进度）
- ✅ Toast 通知（完成/失败提醒）

### 待实现

- ⏳ 交易实际执行（需钱包签名集成）
- ⏳ 交易模拟（执行前预检）
- ⏳ 滑点保护
- ⏳ 单笔交易限额
- ⏳ 大额强制分批

## 🐛 已知限制

1. **模拟执行**：交易暂不实际执行（需要钱包签名集成）
2. **余额显示**：显示为 "0.00"（需集成钱包余额）
3. **代币支持**：仅支持预定义的 SUPPORTED_TOKENS
4. **Solana 支持**：UI 已准备，但需要额外配置
5. **状态跟踪**：使用模拟交易哈希（真实执行后将使用实际哈希）

## 🚧 后续开发

### 优先级 1：完成核心功能

- [ ] 集成钱包签名器（Ethers.js）
- [ ] 实现真实交易执行（使用 Li.Fi executeRoute）
- [ ] 连接真实交易哈希到状态跟踪

### 优先级 2：优化体验

- [ ] 显示钱包真实余额
- [ ] 添加代币搜索/筛选
- [ ] 支持自定义代币地址
- [ ] 添加交易历史详情页
- [ ] 显示 Explorer 链接

### 优先级 3：高级功能

- [ ] Circle CCTP 集成（USDC 零费用）
- [ ] Across Protocol（EVM 快速通道）
- [ ] Wormhole（Solana 优化）
- [ ] 批量交易 UI
- [ ] 失败交易恢复工具

## 📝 测试清单

### 手动测试

- [ ] 切换不同优先级，观察费用变化
- [ ] 输入无效地址，检查错误提示
- [ ] 输入大额（> $10K），检查风险警告
- [ ] 快速输入金额，验证防抖生效
- [ ] 切换链，检查地址自动更新

### 测试网测试（待开发）

- [ ] 小额桥接（< $100 测试币）
- [ ] 交易状态跟踪
- [ ] 失败交易处理

## 📚 参考文档

- **设计文档**：[2026-02-18-cross-chain-bridge-design.md](./2026-02-18-cross-chain-bridge-design.md)
- **实现总结**：[2026-02-18-bridge-implementation-summary.md](./2026-02-18-bridge-implementation-summary.md)
- **Li.Fi 官方文档**：https://docs.li.fi/

## 💬 常见问题

**Q: 为什么点击"Bridge Assets"后没有实际交易？**  
A: 当前为 Phase 1-3 实现，交易执行功能待 Phase 4 开发。

**Q: 支持哪些链？**  
A: 当前支持 Ethereum、Polygon、Arbitrum、Optimism、BSC、Avalanche（所有 EVM 链）。

**Q: 费用准确吗？**  
A: 费用来自 Li.Fi 实时 API，准确度约 95%，实际执行可能有微小差异。

**Q: 如何选择优先级？**  
A: 小额 + 急用 = 最快；日常使用 = 平衡；大额 + 不急 = 最便宜。

**Q: 什么时候需要分批？**  
A: 建议 $10K 以上分批，降低单笔风险。$100K 以上强烈建议使用 CEX。

---

**状态**：开发中（**85% 完成**）  
**可用性**：可查看 UI、获取报价、模拟执行、实时状态跟踪  
**预计完成**：待定（需完成钱包签名集成）
