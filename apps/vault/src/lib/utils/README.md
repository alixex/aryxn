# Utility Functions and Types

通用工具函数、类型定义和数据处理工具。

## 目录结构

```
utils/
├── utils.ts                   # 常用工具函数
├── compression.ts             # 数据压缩和解压
├── types.ts                   # TypeScript 类型定义
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `utils.ts`

常见的工具函数和辅助方法。

```typescript
import {
  cn,
  formatFileSize,
  shortenedAddress,
  formatNumber,
  copyToClipboard,
} from "@/lib/utils"

// 合并 CSS 类
const className = cn("px-2", isActive && "bg-blue-500")

// 格式化文件大小
const size = formatFileSize(1024 * 1024) // "1.0 MB"

// 缩短地址
const addr = shortenedAddress("0x1234...abcd") // "0x1234...abcd"

// 格式化数字
const num = formatNumber(1000.5) // "1,000.5"

// 复制到剪贴板
await copyToClipboard("text")
```

### `compression.ts`

数据压缩和解压缩功能。

```typescript
import { shouldCompressFile, compressData, decompressData } from "@/lib/utils"

// 判断是否应压缩
if (shouldCompressFile(file)) {
  const compressed = await compressData(file)
}

// 解压
const original = await decompressData(compressedData)
```

### `types.ts`

系统级别的 TypeScript 类型定义。

```typescript
import type {
  WalletRecord,
  UploadRecord,
  VaultMetadata,
  WalletKey,
} from "@/lib/utils"
```

## 使用示例

### 场景 1: 样式合并

```typescript
import { cn } from "@/lib/utils"

function Button({ isActive, isDisabled }) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded",
        isActive && "bg-blue-500 text-white",
        isDisabled && "opacity-50 cursor-not-allowed"
      )}
    >
      Click me
    </button>
  )
}
```

### 场景 2: 文件大小格式化

```typescript
import { formatFileSize } from "@/lib/utils"

function FileInfo({ file }) {
  const size = formatFileSize(file.size)
  return <span>{file.name} ({size})</span>
}

// 输出示例：
// document.pdf (2.5 MB)
// image.jpg (512.3 KB)
// archive.zip (1.2 GB)
```

### 场景 3: 地址缩短

```typescript
import { shortenedAddress } from "@/lib/utils"

function AddressDisplay({ address }) {
  return (
    <code>{shortenedAddress(address)}</code>
  )
}

// 输出示例：
// 0x1234567890123456789012345678901234567890
// => 0x1234...7890
```

### 场景 4: 压缩大文件

```typescript
import { shouldCompressFile, compressData } from "@/lib/utils"

async function prepareFileForUpload(file) {
  if (shouldCompressFile(file)) {
    console.log(`文件太大，启用压缩...`)
    const compressed = await compressData(file)

    const ratio = (1 - compressed.size / file.size) * 100
    console.log(`压缩率：${ratio.toFixed(2)}%`)

    return compressed
  }

  return file
}
```

### 场景 5: 数字格式化

```typescript
import { formatNumber } from "@/lib/utils"

function PriceDisplay({ amount }) {
  const formatted = formatNumber(amount, 2)
  return <span>${formatted}</span>
}

// 输出示例：
// 1000 => "1,000"
// 1000.5 => "1,000.50"
// 999999999 => "999,999,999"
```

## API 参考

### `cn(...classes)`

条件式地合并 CSS 类。

```typescript
cn("px-2", isActive && "bg-blue", "font-bold")
// => "px-2 bg-blue font-bold"  (if isActive=true)
// => "px-2 font-bold"           (if isActive=false)
```

### `formatFileSize(bytes)`

将字节转换为可读的文件大小。

```typescript
formatFileSize(0) // "0 B"
formatFileSize(1024) // "1.0 KB"
formatFileSize(1024 * 1024) // "1.0 MB"
formatFileSize(1024 * 1024 * 1024) // "1.0 GB"
```

### `shortenedAddress(address, chars?)`

缩短长地址显示。

```typescript
shortenedAddress("0x1234567890123456789012345678901234567890")
// => "0x1234...7890"

shortenedAddress("0x1234567890123456789012345678901234567890", 6)
// => "0x123456...567890"
```

### `formatNumber(num, decimals?)`

格式化数字为千分位逗号。

```typescript
formatNumber(1000) // "1,000"
formatNumber(1234.567, 2) // "1,234.57"
formatNumber(0.001, 4) // "0.0010"
```

### `copyToClipboard(text)`

复制文本到剪贴板。

```typescript
await copyToClipboard("Hello, world!")
// => true (成功)

// 或显示 toast 提示
await copyToClipboard(address).then(() => {
  toast.success("已复制地址")
})
```

### `shouldCompressFile(file)`

判断是否应压缩文件。

```typescript
shouldCompressFile(tinyFile) // false (太小)
shouldCompressFile(normalFile) // false (正常大小)
shouldCompressFile(largeFile) // true (超过阈值)
```

#### 压缩阈值

- < 100 KB: 不压缩（太小）
- 100 KB - 10 MB: 根据类型决定
- > 10 MB: 总是压缩

### `compressData(data)`

压缩数据。

```typescript
const compressed = await compressData(uint8array)
// => Uint8Array (压缩后的数据)

const ratio = 1 - compressed.size / original.size
console.log(`压缩率：${(ratio * 100).toFixed(2)}%`)
```

### `decompressData(data)`

解压数据。

```typescript
const original = await decompressData(compressedData)
// => Uint8Array (原始数据)
```

## 类型定义

### `WalletRecord`

钱包记录类型。

```typescript
interface WalletRecord {
  address: string
  chain: string
  alias: string
  vault_id: string
  created_at: number
  encrypted_key?: string
}
```

### `UploadRecord`

上传历史记录。

```typescript
interface UploadRecord {
  id: string
  tx_id: string
  file_name: string
  file_size: number
  status: "pending" | "confirmed" | "failed"
  created_at: number
}
```

### `VaultMetadata`

金库元数据。

```typescript
interface VaultMetadata {
  id: string
  name: string
  version: number
  created_at: number
  last_backup: number
}
```

## 性能提示

💡 **建议**

```typescript
// 1. 缓存类名合并结果
const buttonClasses = cn("px-4 py-2", "rounded border", "hover:bg-gray-100")

// 2. 离线格式化数字
const formatted = formatNumber(largeList.length)

// 3. 异步压缩以避免阻塞
const compressed = await compressData(file)

// 4. 批量操作中复用工具
const sizes = files.map((f) => formatFileSize(f.size))
```

## 最佳实践

✅ **推荐**

```typescript
// 正确使用 cn 进行条件类名
const classes = cn("base-class", condition && "conditional-class")

// 处理压缩中的错误
try {
  const compressed = await compressData(data)
} catch (error) {
  console.error("压缩失败：", error)
}

// 检查地址长度
if (address.length > 20) {
  display = shortenedAddress(address)
}
```

❌ **不推荐**

```typescript
// 字符串拼接类名
className = "px-2 " + (isActive ? "bg-blue" : "")

// 同步压缩阻塞 UI
const compressed = compressDataSync(data)

// 未处理异步复制
copyToClipboard(text) // 忽略 Promise
```

## 依赖关系

- `clsx` 或 `classnames` - CSS 类合并
- `lz-string` 或类似库 - 数据压缩
- Native APIs - 剪贴板、File API

## 设计原则

- **简洁性**: 函数签名简单直观
- **可组合性**: 工具可以组个使用
- **兼容性**: 支持多种数据格式
- **性能**: 异步操作不阻塞主线程
