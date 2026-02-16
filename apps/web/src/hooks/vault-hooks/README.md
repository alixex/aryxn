# Upload Hooks

文件上传和同步相关的 hooks。用于处理 Arweave 上传、支付处理和文件同步。

## 目录结构

```
upload-hooks/
├── use-upload-handler.ts       # 文件上传处理（含支付）
├── use-file-sync.ts            # 从 Arweave 同步文件索引
├── README.md                   # 文档
└── index.ts                    # 统一导出
```

## 核心 Hooks 说明

### `useUploadHandler()`

处理文件上传到 Arweave，包括加密、压缩和支付处理。

```typescript
import { useUploadHandler } from "@/hooks/upload-hooks"

const {
  uploading,
  progress,
  stage,
  paymentStage,
  handleUpload,
  handleBatchUpload,
} = useUploadHandler()

await handleUpload(file, encryptUpload, compressUpload, paymentToken)
```

### `useFileSync()`

从 Arweave 同步文件索引到本地数据库。

```typescript
import { useFileSync } from "@/hooks/upload-hooks"

const { syncing, uploadingManifest, syncFromArweave, uploadManifest } =
  useFileSync()

await syncFromArweave()
```

## 使用指南

### 场景 1: 上传文件使用 AR 支付

```typescript
const { handleUpload, uploading, progress } = useUploadHandler()

await handleUpload(
  file,
  true, // 加密
  true, // 压缩
  "AR", // 支付通证
)

// 监听进度
console.log(`上传进度：${progress}%`)
```

### 场景 2: 上传文件使用其他通证支付

```typescript
// 使用 USDC 支付 - 会通过 DEX swap 初始化支付
await handleUpload(file, true, true, "USDC")

// 支付流程：
// 1. 用户持有 USDC
// 2. Hook 调用 DEX swap 将 USDC 转换为 AR
// 3. 使用 AR 上传文件
```

### 场景 3: 同步文件索引

```typescript
const { syncFromArweave, syncing } = useFileSync()

if (!syncing) {
  await syncFromArweave()
}
```

## 支持的支付通证

- AR (Arweave) - 直接上传
- USDC - 通过 DEX swap 转换为 AR
- USDT - 通过 DEX swap 转换为 AR
- ETH - 通过 DEX swap 转换为 AR

## 上传状态流程

```
IDLE
  ↓
PREPARING (验证文件和余额)
  ↓
COMPRESSING (如果启用压缩)
  ↓
ENCRYPTING (如果启用加密)
  ↓
CHECKING_PAYMENT (检查支付通证余额)
  ↓
SWAPPING_TO_AR (如果需要 swap)
  ↓
UPLOADING (上传到 Arweave)
  ↓
CONFIRMING (等待确认)
  ↓
SUCCESS or ERROR
```

## 数据流

### 完整上传流程

```
File Input
  ↓
压缩 (可选)
  ↓
加密 (可选)
  ↓
计算费用
  ↓
检查/获取 AR 通证
  ↓
上传到 Arweave
  ↓
记录交易历史
  ↓
同步文件索引
```

## 架构设计

Upload hooks 都是与**文件操作和 Arweave 集成**相关的，包括：

- **上传处理**: 文件准备、加密、压缩和上传流程
- **支付集成**: 与 DEX hooks 协作处理支付
- **同步管理**: 从 Arweave 获取文件索引到本地
- **交易跟踪**: 维护上传和交易历史

这使得上传功能独立、可测试且易于维护。
↓
同步文件索引

```

## 架构设计

Upload hooks 都是与**文件操作和 Arweave 集成**相关的，包括：

- **上传处理**: 文件准备、加密、压缩和上传流程
- **支付集成**: 与 DEX hooks 协作处理支付
- **同步管理**: 从 Arweave 获取文件索引到本地
- **交易跟踪**: 维护上传和交易历史

这使得上传功能独立、可测试且易于维护。
这使得上传功能独立、可测试且易于维护。
```
