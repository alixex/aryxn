# 费用管理指南

**版本**: 1.0  
**最后更新**: 2026-01-18

---

## 目录

1. [费用机制](#费用机制)
2. [提取流程](#提取流程)
3. [脚本示例](#脚本示例)
4. [统计与报表](#统计与报表)

---

## 费用机制

### 基本概念

**协议费率**: 0.04% (4 basis points)

每次用户交换时，系统自动从**输入金额**中扣除费用：

```
用户输入: 1000 USDT
扣除费用: 1000 × 0.04% = 0.4 USDT
实际交换: 999.6 USDT
费用记录: 0.4 USDT → 累积到合约
```

### 费用流向

```
用户交换交易
    ↓
0.04% 自动扣除
    ↓
存入 collectedFees 映射
    ↓
（可随时提取）
    ↓
转账到 feeReceiver 钱包
```

### 支持的代币

| 代币 | 地址        | 小数位 |
| ---- | ----------- | ------ |
| USDT | 0xdac17f... | 6      |
| USDC | 0xa0b869... | 6      |
| BTC  | 0x226042... | 8      |
| ETH  | 0xC02aaa... | 18     |
| SOL  | 0xD31a59... | 8      |
| AR   | 0x4fadc7... | 18     |
| PUMP | 0x895525... | 8      |
| V2EX | 0x9raU2H... | 18     |
| SUI  | 0x0b27f6... | 6      |

---

## 提取流程

### 1. 查询已收费用

```solidity
function getCollectedFees(address token) external view returns (uint256)
```

**示例**:

```typescript
const feeAmount = await contract.getCollectedFees(USDT_ADDRESS)
console.log(`已收费用：${formatUnits(feeAmount, 6)} USDT`)
```

### 2. 提取费用（智能合约）

```solidity
/**
 * @notice 提取已收的手续费
 * @param token 代币地址
 * @dev 只有 feeReceiver 或 owner 可调用
 */
function withdrawFees(address token) external {
    require(
        msg.sender == feeReceiver || msg.sender == owner(),
        "Not authorized"
    );
    require(_isSupportedToken(token), "Token not supported");

    uint256 feeAmount = collectedFees[token];
    require(feeAmount > 0, "No fees to withdraw");

    // 清零费用记录
    collectedFees[token] = 0;

    // 转账到指定地址
    IERC20(token).safeTransfer(feeReceiver, feeAmount);

    emit ProtocolFeeCollected(token, feeAmount, feeReceiver);
}
```

### 3. 权限管理

| 角色            | 权限                           |
| --------------- | ------------------------------ |
| **owner**       | 部署者，拥有所有权限           |
| **feeReceiver** | 指定的费用接收地址，可提取费用 |
| **其他地址**    | 无法提取或修改                 |

### 4. 修改费用接收地址

```solidity
function setFeeReceiver(address newReceiver) external onlyOwner {
    require(newReceiver != address(0), "Invalid address");
    feeReceiver = newReceiver;
    emit FeeReceiverUpdated(newReceiver);
}
```

---

## 脚本示例

### 单次提取

```typescript
import { ethers } from "ethers";

const SWAPPER_ADDRESS = "0x..."; // 部署后的合约地址
const ABI = [...]; // 合约 ABI

async function withdrawSingleToken(tokenAddress: string) {
  // 连接钱包
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // 创建合约实例
  const contract = new ethers.Contract(SWAPPER_ADDRESS, ABI, signer);

  // 查询已收费用
  const feeAmount = await contract.getCollectedFees(tokenAddress);

  if (feeAmount === 0n) {
    console.log("无可提取的费用");
    return;
  }

  console.log(`准备提取：${ethers.formatUnits(feeAmount, 6)} tokens`);

  // 执行提取
  const tx = await contract.withdrawFees(tokenAddress);
  console.log(`交易发送：${tx.hash}`);

  // 等待确认
  const receipt = await tx.wait();
  console.log(`✅ 提取成功：${receipt.transactionHash}`);
  console.log(`Gas 消耗：${receipt.gasUsed.toString()}`);
}

withdrawSingleToken("0xdac17f958d2ee523a2206206994597c13d831ec7");
```

### 批量提取所有代币

```typescript
async function withdrawAllFees() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  const contract = new ethers.Contract(SWAPPER_ADDRESS, ABI, signer)

  // 所有支持的代币
  const tokens = [
    {
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      symbol: "USDT",
      decimals: 6,
    },
    {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      symbol: "USDC",
      decimals: 6,
    },
    {
      address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      symbol: "BTC",
      decimals: 8,
    },
    {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "ETH",
      decimals: 18,
    },
    {
      address: "0xD31a59c85aE9D8edEFeC411D448f90d4b0d81299",
      symbol: "SOL",
      decimals: 8,
    },
    {
      address: "0x4fadc7a98f2dc96510e42dd1a74141eeae0c1543",
      symbol: "AR",
      decimals: 18,
    },
  ]

  let totalGasUsed = 0n
  let withdrawnCount = 0

  for (const token of tokens) {
    const feeAmount = await contract.getCollectedFees(token.address)

    if (feeAmount === 0n) {
      console.log(`⏭️  ${token.symbol}: 无费用`)
      continue
    }

    console.log(
      `📤 提取 ${ethers.formatUnits(feeAmount, token.decimals)} ${token.symbol}`,
    )

    try {
      const tx = await contract.withdrawFees(token.address)
      const receipt = await tx.wait()

      totalGasUsed += receipt.gasUsed
      withdrawnCount++

      console.log(`   ✅ 成功 (Gas: ${receipt.gasUsed})`)
    } catch (error) {
      console.error(`   ❌ 失败：${error.message}`)
    }
  }

  console.log(`\n📊 总结:`)
  console.log(`   提取代币数：${withdrawnCount}`)
  console.log(`   总 Gas: ${totalGasUsed}`)
}

withdrawAllFees().catch(console.error)
```

### 定时自动提取

```typescript
import cron from "node-cron"

// 每天凌晨 2 点自动提取
cron.schedule("0 2 * * *", async () => {
  console.log(`[${new Date().toISOString()}] 开始自动提取费用...`)

  try {
    await withdrawAllFees()
    console.log("✅ 自动提取完成")
  } catch (error) {
    console.error("❌ 自动提取失败：", error)
    // 发送告警通知
    await sendAlertNotification(error.message)
  }
})

console.log("费用自动提取已启用（每天 02:00）")
```

### 更新费用接收地址

```typescript
async function updateFeeReceiver(newAddress: string) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  const contract = new ethers.Contract(SWAPPER_ADDRESS, ABI, signer)

  // 验证地址格式
  if (!ethers.isAddress(newAddress)) {
    throw new Error("无效的以太坊地址")
  }

  console.log(`更新费用接收地址：${newAddress}`)

  const tx = await contract.setFeeReceiver(newAddress)
  console.log(`交易：${tx.hash}`)

  const receipt = await tx.wait()

  if (receipt.status === 1) {
    console.log("✅ 地址更新成功")
    return receipt.transactionHash
  } else {
    throw new Error("交易失败")
  }
}

updateFeeReceiver("0x742d35Cc6634C0532925a3b844Bc5e707dd4bD9d")
```

---

## 统计与报表

### 实时费用仪表板

```typescript
interface FeeStats {
  timestamp: Date;
  tokenStats: {
    symbol: string;
    address: string;
    collectedFees: string; // 已收费用
    collectedUSD: number;  // 折合美元
    lastWithdrawn: Date;   // 最后提取时间
    pendingFees: string;   // 待提取费用
  }[];
  totalCollectedUSD: number;
  totalWithdrawnUSD: number;
}

async function getFeeStats(): Promise<FeeStats> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const contract = new ethers.Contract(SWAPPER_ADDRESS, ABI, provider);

  const tokens = [...]; // 代币列表
  const priceOracle = new PriceOracle(); // 价格预言机

  const tokenStats = [];
  let totalCollectedUSD = 0;

  for (const token of tokens) {
    const feeAmount = await contract.getCollectedFees(token.address);
    const price = await priceOracle.getPrice(token.symbol);
    const collectedUSD = parseFloat(
      ethers.formatUnits(feeAmount, token.decimals)
    ) * price;

    tokenStats.push({
      symbol: token.symbol,
      address: token.address,
      collectedFees: ethers.formatUnits(feeAmount, token.decimals),
      collectedUSD,
      lastWithdrawn: null, // 从事件日志获取
      pendingFees: ethers.formatUnits(feeAmount, token.decimals),
    });

    totalCollectedUSD += collectedUSD;
  }

  return {
    timestamp: new Date(),
    tokenStats,
    totalCollectedUSD,
    totalWithdrawnUSD: 0, // 从历史交易计算
  };
}
```

### 周报表

```typescript
async function generateWeeklyReport() {
  const stats = await getFeeStats()

  console.log(`\n${"=".repeat(60)}`)
  console.log(`📊 费用周报 - ${stats.timestamp.toLocaleDateString("zh-CN")}`)
  console.log(`${"=".repeat(60)}`)

  console.log(`\n💰 按代币统计:`)
  console.log(
    `${"Token".padEnd(10)} | ${"金额".padEnd(15)} | ${"USD 价值".padEnd(15)}`,
  )
  console.log(`${"-".repeat(42)}`)

  stats.tokenStats.forEach((stat) => {
    console.log(
      `${stat.symbol.padEnd(10)} | ${stat.collectedFees.padEnd(15)} | $${stat.collectedUSD.toFixed(2).padEnd(15)}`,
    )
  })

  console.log(`${"-".repeat(42)}`)
  console.log(
    `${"总计".padEnd(10)} | ${"".padEnd(15)} | $${stats.totalCollectedUSD.toFixed(2)}`,
  )
  console.log(`\n✅ 已提取：$${stats.totalWithdrawnUSD.toFixed(2)}`)
  console.log(
    `⏳ 待提取：$${(stats.totalCollectedUSD - stats.totalWithdrawnUSD).toFixed(2)}`,
  )
  console.log(`\n`)
}
```

### 月度收入预测

```typescript
interface IncomeProjection {
  currentUSD: number
  monthlyProjection: number
  annualProjection: number
  breakEvenVolume: number // 盈亏平衡点
}

async function projectIncome(): Promise<IncomeProjection> {
  const stats = await getFeeStats()

  // 计算平均每天费用
  const daysRunning = 30 // 运行天数
  const avgDailyFee = stats.totalCollectedUSD / daysRunning
  const monthlyProjection = avgDailyFee * 30
  const annualProjection = avgDailyFee * 365

  // 运营成本（示例）
  const monthlyOperatingCost = 1000 // $1000/月
  const breakEvenVolume = monthlyOperatingCost / 0.0004 // 0.04% fee

  return {
    currentUSD: stats.totalCollectedUSD,
    monthlyProjection,
    annualProjection,
    breakEvenVolume,
  }
}

const projection = await projectIncome()
console.log(`📈 收入预测`)
console.log(`   当前：$${projection.currentUSD.toFixed(2)}`)
console.log(`   月预测：$${projection.monthlyProjection.toFixed(2)}`)
console.log(`   年预测：$${projection.annualProjection.toFixed(2)}`)
console.log(`   盈亏平衡点：$${projection.breakEvenVolume.toFixed(0)}`)
```

---

## 最佳实践

### ✅ 建议做法

1. **定期提取**: 每周或每月提取一次，节省 gas
2. **监控费用**: 设置告警，当费用达到某个阈值时提醒
3. **记录日志**: 保留所有提取交易的记录用于审计
4. **多签审计**: 大额提取使用多签钱包
5. **备份私钥**: 妥善保管 feeReceiver 钱包的私钥

### ❌ 应避免

1. ~~过于频繁提取~~ (gas 费用高)
2. ~~在 gas 高峰期提取~~ (浪费成本)
3. ~~使用不安全的钱包地址~~
4. ~~忘记备份密钥~~
5. ~~不记录提取日志~~

---

## 常见问题

**Q: 多久应该提取一次？**  
A: 建议每周或月初提取一次，平衡 gas 费用和流动性。

**Q: 费用是从用户身上扣还是从输出扣？**  
A: 从**输入**扣除，用户实际交换金额减少 0.04%。

**Q: 可以更改费率吗？**  
A: 可以，owner 可以调用 `setProtocolFeeRate(newBps)`。

**Q: 提取失败怎么办？**  
A: 检查 gas 价格、地址权限和代币是否支持。

**Q: 如何证明费用透明？**  
A: 在 Etherscan 上验证源代码，所有交易都可查看。

---

**版本**: 1.0  
**状态**: 生产就绪  
**最后更新**: 2026-01-18
