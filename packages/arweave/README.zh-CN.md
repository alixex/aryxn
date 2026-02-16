# @aryxn/arweave

Aryxn 的简化版 Arweave 协议封装库，移除了对于特定 Tags (标签) 的硬编码。该包专注于文件上传、交易签名和费用估算，依赖应用层提供具体的元数据标签。

## 功能特性

- **上传**: 处理数据交易的创建、签名，并发布到 Arweave 网络。
- **压缩**: 包含压缩检测工具，并根据压缩后的体积估算费用。
- **费用估算**: 准确计算原始内容和压缩内容的上传成本。

## API 参考

| 函数                                   | 说明                                             |
| :------------------------------------- | :----------------------------------------------- |
| `uploadToArweave(data, key, tags)`     | 使用指定标签上传数据到 Arweave。处理签名和发布。 |
| `estimateArweaveFee(size)`             | 估算给定数据大小的交易费用 (Winston)。           |
| `shouldCompressFile(file, threshold?)` | 根据大小和类型判断文件是否应该被压缩。           |
| `compressData(data)`                   | 使用 `fflate` (GZIP) 压缩数据。                  |
| `decompressData(data)`                 | 解压缩 GZIP 数据。                               |

## 使用示例

```typescript
import { uploadToArweave, estimateArweaveFee } from "@aryxn/arweave"

// 估算费用
const fee = await estimateArweaveFee(fileSize)

// 带自定义标签上传
const txId = await uploadToArweave(data, walletKey, [
  { name: "Content-Type", value: "image/png" },
])
```
