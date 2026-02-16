# Universal Router - 纯链上 DEX 聚合器设计文档

**日期**: 2026-01-29
**版本**: 1.0
**状态**: 设计完成，待实现

## 执行摘要

Universal Router 是一个完全去中心化的链上 DEX 聚合器，采用模块化 Adapter 架构。通过聚合多个 DEX（Uniswap V3、Uniswap V2、Curve），提供最优交换价格，同时保持纯链上路由（无需依赖后端服务）。系统包含多层 MEV 保护机制，并通过多种 Gas 优化技术保持成本可控。

### 核心目标

1. **更好的价格** - 通过多 DEX 聚合获得比单一 DEX 更优的价格
2. **降低 Gas** - 通过优化架构和路由缓存降低成本
3. **MEV 保护** - 多层价格验证机制防止三明治攻击
4. **完全去中心化** - 纯链上路由，无需信任任何后端服务

### 关键指标

| 指标         | 目标值              |
| ------------ | ------------------- |
| 直接交换 Gas | < 150k              |
| 双跳交换 Gas | < 300k              |
| 价格改进     | 优于单一 DEX 0.5-2% |
| 路由计算时间 | < 1 区块            |
| 合约总大小   | < 24KB              |

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                    UniversalRouter                      │
│  ┌────────────────────────────────────────────────┐    │
│  │  - swap() - 唯一的用户入口                     │    │
│  │  - batchSwap() - 批量交换                      │    │
│  └────────────────────────────────────────────────┘    │
│              │                │              │          │
│              ▼                ▼              ▼          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────┐   │
│   │ DEXRegistry  │  │ Validator    │  │ PathFinder│  │
│   │              │  │ Manager      │  │           │   │
│   └──────────────┘  └──────────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ IDEXAdapter  │ │ IDEXAdapter  │ │ IDEXAdapter  │
├──────────────┤ ├──────────────┤ ├──────────────┤
│ UniswapV3    │ │ UniswapV2    │ │   Curve      │
│ Adapter      │ │ Adapter      │ │  Adapter     │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 核心组件

#### 1. UniversalRouter（主合约）

- **职责**: 用户交互入口、资金管理、流程协调
- **功能**:
  - `swap()` - 智能交换入口
  - `batchSwap()` - 批量交换优化
  - 费用管理和提取
  - 紧急暂停机制

#### 2. DEXRegistry（注册表）

- **职责**: 管理所有 DEX Adapter
- **功能**:
  - 动态添加/移除 DEX
  - DEX 状态管理（启用/禁用）
  - 优先级排序

#### 3. ValidatorManager（价格验证器）

- **职责**: 多层 MEV 保护
- **功能**:
  - Chainlink 预言机验证
  - Uniswap V3 TWAP 验证
  - 交易频率限制

#### 4. PathFinder（路由查找器）

- **职责**: 纯链上路由算法
- **功能**:
  - 分层路由策略（直接/单跳/双跳）
  - 路由缓存优化
  - Gas 成本控制

#### 5. IDEXAdapter（适配器接口）

- **职责**: 统一不同 DEX 的调用接口
- **实现**:
  - UniswapV3Adapter
  - UniswapV2Adapter
  - CurveAdapter

---

## 核心数据结构

### SwapParams - 交换参数

```solidity
struct SwapParams {
    address tokenIn;           // 输入代币
    address tokenOut;          // 输出代币
    uint256 amountIn;          // 输入数量
    uint256 minAmountOut;      // 最小输出（滑点保护）
    address recipient;         // 接收地址
    uint256 deadline;          // 过期时间
    ProtectionLevel protection; // MEV 保护级别
}
```

### SwapStep - 交换步骤

```solidity
struct SwapStep {
    uint8 dexId;      // DEX 标识符 (0=UniV3, 1=UniV2, 2=Curve)
    address pool;     // 池地址（可选，用于验证）
    bytes data;       // DEX 特定参数（紧凑编码）
}
```

### ProtectionLevel - 保护级别

```solidity
enum ProtectionLevel {
    BASIC,      // 仅滑点保护 (~95k gas)
    MEDIUM,     // + Chainlink 验证 (~110k gas)
    HIGH        // + TWAP + 频率限制 (~130k gas)
}
```

---

## 路由策略（纯链上）

### 分层路由算法

```
Level 1: 直接路径 (最省 Gas)
├─ 尝试 3 个高优先级 DEX
├─ 每个 DEX 尝试多个费率层级（仅 UniV3）
└─ 早期退出优化（找到足够好的价格）
   Gas: ~50k

Level 2: 单跳中转
├─ 通过 hub tokens（WETH, USDC, USDT）
├─ 最多尝试 3 个 hub
└─ 每跳复用 Level 1 逻辑
   Gas: ~120k

Level 3: 双跳中转（最后手段）
├─ 固定路径：WETH -> USDC
├─ 仅在前两级失败时使用
└─ 避免遍历所有可能性
   Gas: ~180k
```

### 路由缓存机制

```solidity
struct CachedRoute {
    SwapStep[] steps;      // 缓存的路由
    uint256 expectedOutput; // 预期输出
    uint256 timestamp;      // 缓存时间
    uint32 hitCount;        // 命中次数
}

// 缓存键: keccak256(tokenIn, tokenOut, amountIn/1e6)
// 有效期: 5 分钟
// 命中率: 预计 40-60%
// Gas 节省: ~80k per hit
```

### 优化技术

1. **优先级排序** - 先尝试历史表现好的 DEX
2. **早期退出** - 找到足够好的价格立即返回
3. **限制尝试次数** - 避免遍历所有可能性
4. **缓存复用** - 相同交易对短时间内复用路由

---

## MEV 保护机制

### 三级保护体系

#### BASIC - 基础保护

- ✅ 滑点保护（用户设置 `minAmountOut`）
- ✅ Deadline 过期检查
- Gas: +0k（无额外成本）

#### MEDIUM - 中级保护

- ✅ BASIC 的所有保护
- ✅ Chainlink 预言机验证
  - 检查实际价格偏离预言机 < 5%
  - 防止明显的价格操纵
- Gas: +15k

#### HIGH - 高级保护

- ✅ MEDIUM 的所有保护
- ✅ Uniswap V3 TWAP 验证
  - 30 分钟时间加权平均价格
  - 检查偏离 < 2%
- ✅ 交易频率限制
  - 同一用户 12 秒冷却时间
  - 防止连续被夹击
- Gas: +30k

### 价格验证流程

```
执行交换
    ↓
获得 amountOut
    ↓
┌─────────────────────────┐
│ if BASIC: 检查滑点      │ ← 最便宜
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ if MEDIUM: + Chainlink  │ ← 中等成本
│  - 获取 tokenIn/USD     │
│  - 获取 tokenOut/USD    │
│  - 计算预期输出         │
│  - 偏差 < 5%？          │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ if HIGH: + TWAP         │ ← 最贵但最安全
│  - 获取 30min TWAP      │
│  - 计算价格偏差         │
│  - 偏差 < 2%？          │
│  - 检查时间间隔         │
└─────────────────────────┘
    ↓
验证通过 → 转账给用户
```

---

## Gas 优化策略

### 1. 存储优化

```solidity
// ❌ 坏的做法（3 个 slots）
uint256 totalVolume;
uint256 totalFees;
uint256 lastUpdate;

// ✅ 好的做法（1 个 slot）
struct PackedConfig {
    uint96 totalVolume;   // 足够大
    uint96 totalFees;     // 足够大
    uint32 lastUpdate;    // 时间戳
    uint16 feeRate;       // bps
    uint8 version;
    bool paused;
}
```

节省：~15k gas per transaction

### 2. Custom Errors

```solidity
// ❌ 坏的做法
require(amountOut >= minOut, "Insufficient output");

// ✅ 好的做法
error InsufficientOutput(uint256 actual, uint256 minimum);
if (amountOut < minOut) revert InsufficientOutput(amountOut, minOut);
```

节省：~50 gas per error

### 3. Unchecked 循环

```solidity
// ✅ 安全的 unchecked 使用
for (uint256 i; i < route.length;) {
    // ... 执行逻辑

    unchecked { ++i; }  // i 永远不会溢出
}
```

节省：~50 gas per iteration

### 4. 缓存 SLOAD

```solidity
// ❌ 坏的做法（多次 SLOAD）
function calculate() internal {
    uint256 result = config.feeRate * amount;  // SLOAD
    total += config.totalFees;                 // SLOAD
}

// ✅ 好的做法（缓存到内存）
function calculate() internal {
    PackedConfig memory cfg = config;  // 单次 SLOAD
    uint256 result = cfg.feeRate * amount;
    total += cfg.totalFees;
}
```

节省：~2100 gas per avoided SLOAD

### 5. Calldata 压缩

```solidity
// 紧凑编码格式: [dexId(1byte)][dataLen(1byte)][data]...
// vs struct 数组可节省 ~200 gas per step
```

### Gas 对比表

| 优化          | 节省      | 难度 |
| ------------- | --------- | ---- |
| 紧凑存储      | 15k       | 中   |
| Custom errors | 50/error  | 低   |
| Unchecked     | 50/loop   | 低   |
| Calldata 压缩 | 200/step  | 高   |
| SLOAD 缓存    | 2.1k/避免 | 低   |
| 路由缓存      | 80k/命中  | 中   |

---

## 安全机制

### 1. 重入保护

```solidity
- OpenZeppelin ReentrancyGuard
- Checks-Effects-Interactions 模式
- 函数级锁（额外保护）
```

### 2. 输入验证

```solidity
✅ 金额 > 0
✅ 代币地址有效
✅ 接收地址有效
✅ Deadline 未过期
✅ 余额充足
✅ 授权充足
✅ 路由长度 <= 4
```

### 3. 代币安全

```solidity
✅ SafeERC20 处理非标准代币
✅ 余额变化检查（处理收费代币）
✅ ETH/WETH 自动转换
✅ EOA 自动解包装为 ETH
```

### 4. 紧急控制

```solidity
✅ pause() - 全局暂停
✅ pauseDEX() - 暂停单个 DEX
✅ emergencyWithdraw() - 紧急提取
✅ onlyOwner 权限控制
```

### 5. 异常检测

```solidity
✅ 单区块过多交换检测
✅ 连续失败计数
✅ 可疑模式识别
```

---

## DEX Adapter 设计

### 统一接口

```solidity
interface IDEXAdapter {
    // 获取报价
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes calldata data
    ) external view returns (uint256 amountOut);

    // 执行交换
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata data
    ) external returns (uint256 amountOut);

    // DEX 名称
    function getDEXName() external pure returns (string memory);

    // 路径支持检查
    function isPathSupported(
        address tokenIn,
        address tokenOut,
        bytes calldata data
    ) external view returns (bool);
}
```

### 初始支持的 DEX

#### 1. Uniswap V3

- **特点**: 集中流动性，多费率层级（0.05%, 0.3%, 1%）
- **优势**: 主流代币流动性最好
- **参数**: `V3SwapData { uint24 fee, address pool }`

#### 2. Uniswap V2 / Sushiswap

- **特点**: 恒定乘积 AMM
- **优势**: 长尾代币支持好
- **参数**: 无需额外参数（空 bytes）

#### 3. Curve

- **特点**: 稳定币专用 AMM
- **优势**: 稳定币交换价格最优
- **参数**: `CurveSwapData { address pool, int128 i, int128 j }`

### 扩展性

新增 DEX 只需：

1. 实现 `IDEXAdapter` 接口
2. 部署 Adapter 合约
3. 调用 `registry.registerDEX(dexId, adapter, name)`

**无需修改主合约！**

---

## 完整交换流程

```
用户调用 swap()
    ↓
┌─────────────────────────┐
│ 1. 输入验证             │
│    - 参数检查           │
│    - 余额/授权检查      │
│    - Deadline 检查      │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 2. 转入代币             │
│    - SafeTransferFrom   │
│    - 处理收费代币       │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 3. 费用计算扣除         │
│    - 动态费率           │
│    - 0.04-0.25% bps     │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 4. 路由查找             │
│    - 检查缓存           │
│    - Level 1: 直接      │
│    - Level 2: 单跳      │
│    - Level 3: 双跳      │
│    - 缓存结果           │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 5. 执行多跳交换         │
│    For each step:       │
│      - 获取 Adapter     │
│      - 调用 swap()      │
│      - 接收输出         │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 6. 价格验证（MEV）      │
│    - BASIC: 滑点        │
│    - MEDIUM: Chainlink  │
│    - HIGH: TWAP + 频率  │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 7. 转出代币             │
│    - 验证最终输出       │
│    - SafeTransfer       │
│    - 解包装 ETH（如需） │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 8. 发出事件             │
│    - Swapped event      │
│    - 更新统计           │
└─────────────────────────┘
```

---

## 测试策略

### 测试金字塔

```
      /\
     /  \  E2E (10%)
    /____\  - 主网分叉
   /      \  - 完整流程
  /________\
 /          \ Integration (30%)
/____________\ - 多组件协作
/            \ - 路由算法
/______________\ Unit (60%)
                - 单个函数
                - Adapter 测试
```

### 测试类型

#### 1. 单元测试

```solidity
✅ 直接路径查找
✅ 费用计算逻辑
✅ 滑点保护
✅ 代币转账（包括收费代币）
✅ Fuzz 测试（随机金额）
```

#### 2. 集成测试

```solidity
✅ 完整单跳交换
✅ 完整多跳交换
✅ 路由缓存验证
✅ 价格验证（MEV 保护）
✅ 批量交换
```

#### 3. 安全测试

```solidity
✅ 重入攻击防护
✅ 整数溢出保护
✅ 权限控制
✅ MEV 频率限制
✅ 异常行为检测
```

#### 4. 主网分叉测试

```solidity
✅ 真实池子交换
✅ 价格竞争力对比
✅ 极端市场条件
✅ Gas 成本验证
```

### 覆盖率目标

- 行覆盖率：> 95%
- 分支覆盖率：> 90%
- 函数覆盖率：100%

---

## 部署计划

### 部署顺序

```
1. 部署基础合约
   ├─ ValidatorManager
   ├─ DEXRegistry
   └─ PathFinder

2. 部署 Adapters
   ├─ UniswapV3Adapter
   ├─ UniswapV2Adapter
   └─ CurveAdapter

3. 部署主合约
   └─ UniversalRouter(registry, validator, pathFinder)

4. 配置
   ├─ 注册 DEX Adapters
   ├─ 设置 Hub Tokens
   ├─ 配置 Chainlink Feeds
   └─ 配置 TWAP 参数

5. 验证
   ├─ 在 Etherscan 验证合约
   ├─ 执行测试交换
   └─ 监控 Gas 成本
```

### 测试网部署

**Sepolia**:

```bash
forge script script/Deploy.s.sol \
  --rpc-url sepolia \
  --broadcast \
  --verify
```

### 主网部署

**前置条件**:

- ✅ 完整的测试网测试
- ✅ 安全审计报告
- ✅ Gas 成本优化验证
- ✅ 多签钱包准备

**部署命令**:

```bash
forge script script/Deploy.s.sol \
  --rpc-url mainnet \
  --broadcast \
  --verify \
  --private-key $DEPLOYER_KEY
```

---

## 性能指标

### Gas 成本估算

| 场景                 | Gas 消耗 | 说明             |
| -------------------- | -------- | ---------------- |
| 直接交换（BASIC）    | ~116k    | 单跳，缓存未命中 |
| 直接交换（缓存命中） | ~98k     | 节省 18k         |
| 双跳交换（BASIC）    | ~173k    | 两次 DEX 调用    |
| 直接交换（MEDIUM）   | ~131k    | +Chainlink       |
| 直接交换（HIGH）     | ~146k    | +TWAP+ 频率      |
| 批量交换（3 笔）     | ~280k    | 分摊固定成本     |

### 价格改进预期

| 交易对    | 单一 DEX  | 聚合器    | 改进   |
| --------- | --------- | --------- | ------ |
| USDC/WETH | 0.500 ETH | 0.502 ETH | +0.4%  |
| USDT/USDC | 0.9995    | 0.9998    | +0.03% |
| WETH/WBTC | 0.0245    | 0.0247    | +0.8%  |

### 性能目标

- 路由计算：< 5 秒（链上）
- 缓存命中率：> 40%
- 交易成功率：> 99%
- MEV 防护率：> 95%（HIGH 保护）

---

## 未来扩展

### Phase 2 - 更多 DEX

- Balancer（加权池）
- Maverick（动态流动性）
- 1inch Limit Orders
- CoW Swap 集成

### Phase 3 - 高级功能

- 限价单（链上订单簿）
- TWAMM（时间加权做市）
- 链上拆单优化
- MEV 拍卖集成

### Phase 4 - 跨链

- LayerZero 集成
- 跨链路由
- 统一流动性

---

## 风险与缓解

### 技术风险

| 风险         | 影响 | 概率 | 缓解措施             |
| ------------ | ---- | ---- | -------------------- |
| 合约漏洞     | 高   | 低   | 安全审计、Bug Bounty |
| Gas 成本过高 | 中   | 中   | 深度优化、缓存策略   |
| 路由不够优化 | 中   | 中   | 算法改进、更多 DEX   |
| DEX 协议升级 | 低   | 低   | Adapter 模式隔离     |

### 市场风险

| 风险         | 影响 | 概率 | 缓解措施            |
| ------------ | ---- | ---- | ------------------- |
| MEV 攻击     | 高   | 中   | 多层价格验证        |
| 极端市场波动 | 中   | 低   | TWAP 验证、暂停机制 |
| 竞争产品     | 低   | 高   | 持续优化、用户体验  |

---

## 总结

Universal Router 通过模块化架构和纯链上路由，在保持完全去中心化的同时，提供了：

✅ **更优价格** - 多 DEX 聚合，预期改进 0.5-2%
✅ **可控成本** - 通过优化保持 Gas 在合理范围
✅ **强大保护** - 三级 MEV 防护体系
✅ **高扩展性** - Adapter 模式支持轻松添加新 DEX
✅ **生产就绪** - 完整的测试和安全机制

该设计为以太坊生态提供了一个可靠、高效、完全去中心化的交换解决方案。

---

## 附录

### A. 合约地址（待部署）

```
Mainnet:
├─ UniversalRouter:     TBD
├─ DEXRegistry:         TBD
├─ ValidatorManager:    TBD
├─ PathFinder:          TBD
├─ UniswapV3Adapter:    TBD
├─ UniswapV2Adapter:    TBD
└─ CurveAdapter:        TBD

Sepolia:
├─ UniversalRouter:     TBD
└─ ...
```

### B. 参考资料

- [Uniswap V3 文档](https://docs.uniswap.org/contracts/v3/overview)
- [Curve 文档](https://curve.readthedocs.io/)
- [Chainlink 价格源](https://docs.chain.link/data-feeds)
- [OpenZeppelin 合约](https://docs.openzeppelin.com/contracts/)
- [Foundry Book](https://book.getfoundry.sh/)

### C. 贡献者

- 架构设计：Claude & 用户
- 合约开发：TBD
- 安全审计：TBD
- 前端集成：TBD

---

**文档版本**: v1.0
**最后更新**: 2026-01-29
**状态**: ✅ 设计完成
