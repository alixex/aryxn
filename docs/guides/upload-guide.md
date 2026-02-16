# 文件上传操作指南

## 概述

Aryxn 使用 Arweave 原生协议上传文件，数据直接永久存储在 Arweave 主网上。支持端到端加密，确保文件隐私安全。

---

## Arweave Native 上传

### 特点

- ✅ **永久存储**：数据直接存储在 Arweave 主网，永久保存
- ✅ **完全控制**：使用本地 Arweave 账户，完全自主控制
- ✅ **端到端加密**：支持端到端加密，保护文件隐私
- ✅ **去中心化**：数据分布在 Arweave 网络的多个节点上

### 前置条件

1. **隐私保险箱已解锁**：必须解锁隐私保险箱才能使用此功能
2. **Arweave 账户**：需要创建或导入一个 Arweave 账户
3. **账户余额**：确保 Arweave 账户有足够的 AR 代币

### 操作步骤

#### 步骤 1：解锁隐私保险箱

1. 如果隐私保险箱未解锁，页面会显示锁定提示
2. 点击 **"前往账户管理"** 按钮
3. 在账户管理页面输入主密码解锁
4. 解锁成功后返回上传页面

#### 步骤 2：准备 Arweave 账户

如果还没有 Arweave 账户，需要先创建或导入：

**创建新账户**：

1. 在上传页面中，点击 **"新建"** 按钮
2. 系统会自动生成新的 Arweave 密钥对
3. 输入账户别名（如 "我的主账户"）
4. 密钥文件会自动下载到本地（请妥善保管）
5. 账户创建成功后会自动设置为当前使用账户

**导入现有账户**：

1. 点击 **"导入"** 按钮
2. 选择你的 Arweave 密钥 JSON 文件
3. 输入账户别名
4. 导入成功后，账户会添加到账户列表

**选择账户**：

- 如果已有多个账户，在账户列表中选择要使用的账户
- 点击账户卡片即可切换

#### 步骤 3：选择文件

1. 在 **"选择文件"** 区域点击文件选择按钮
2. 选择要上传的文件

#### 步骤 4：配置加密选项

1. 勾选 **"开启端到端加密"** 复选框以启用加密
   - ✅ **已勾选**：文件将使用主密钥加密后上传
   - ❌ **未勾选**：文件将以明文形式上传

**注意**：加密选项默认启用，建议保持勾选以确保文件隐私。

#### 步骤 5：确认并上传

1. 确认文件已选择
2. 确认已选择 Arweave 账户
3. 点击 **"刻录并加密至 Arweave"** 按钮
4. 等待上传完成：
   - 上传过程中会显示详细的实时进度（包括准备、加密、签名及数据上传百分比）
   - Arweave 上传可能需要更长时间，请耐心等待
5. 上传成功后，会显示成功提示："已上传至 Arweave！"
6. 上传记录会自动保存到本地数据库

### 账户余额管理

- **查看余额**：在账户管理页面可以查看每个 Arweave 账户的余额
- **充值 AR**：需要从交易所或其他钱包向 Arweave 地址充值 AR 代币
- **费用估算**：上传前系统会计算所需费用，确保账户有足够余额

### 访问上传的文件

上传成功后，可以通过以下方式访问：

- **Arweave 网关**：`https://arweave.net/{交易ID}`
- 交易 ID 会保存在本地数据库中，可在控制面板查看

---

## 加密功能说明

### 端到端加密

Arweave 上传支持端到端加密（E2EE），加密流程如下：

1. **密钥派生**：使用 PBKDF2 从主密码派生加密密钥
   - 算法：PBKDF2
   - 哈希：SHA-256
   - 迭代次数：100,000
   - 密钥长度：256 位（32 字节）

2. **数据加密**：使用 XChaCha20-Poly1305 加密文件数据
   - 算法：XChaCha20-Poly1305（libsodium）
   - Nonce：随机生成（24 字节）
   - 输出：密文 + nonce

3. **元数据存储**：加密信息存储在交易标签中
   - `Encryption-Algo`: "XChaCha20-Poly1305"
   - `Encryption-Params`: `{"nonce": "<base64-encoded-nonce>"}`

### 加密 vs 公开上传

| 特性           | 加密上传                        | 公开上传                   |
| -------------- | ------------------------------- | -------------------------- |
| **隐私保护**   | ✅ 只有拥有主密码的用户可以解密 | ❌ 任何人都可以访问        |
| **主密码要求** | ✅ 需要主密码                   | ❌ 不需要                  |
| **文件大小**   | 略大（包含加密元数据）          | 原始大小                   |
| **适用场景**   | 敏感文件、个人文档              | 公开分享、不需要隐私的文件 |

**建议**：对于包含敏感信息的文件，强烈建议启用加密上传。

---

## 常见问题

### Q1: 上传失败怎么办？

**可能原因和解决方案**：

1. **账户余额不足**
   - 确保 Arweave 账户有足够的 AR 代币
   - 解决方案：充值 AR 代币

2. **网络连接问题**
   - 系统内置**自动重试机制**，遇到网络波动会自动尝试续传当前分片
   - **重要**：请保持页面开启，**不要关闭或刷新页面**，否则进度会丢失
   - 若自动重试多次仍无反应，请检查本机网络连接是否正常

3. **文件过大**
   - Arweave 支持大文件，但需要足够的余额
   - 如果文件特别大，可能需要等待更长时间

4. **隐私保险箱未解锁**
   - 确保已解锁隐私保险箱
   - 前往账户管理页面解锁

### Q2: 如何查看上传历史？

1. 点击导航栏中的 **"控制面板"**
2. 在历史记录表格中查看所有上传记录
3. 可以查看文件名、协议、加密状态等信息
4. 点击操作按钮可以下载文件（需要主密码解密）

### Q3: 加密文件如何解密？

1. 确保隐私保险箱已解锁
2. 在控制面板中找到要下载的文件
3. 点击操作按钮
4. 系统会自动使用主密钥解密文件
5. 解密后的文件会自动下载到本地

### Q4: 忘记主密码怎么办？

⚠️ **重要警告**：如果忘记主密码，将**无法恢复**以下内容：

- 已加密的文件
- 已保存的账户密钥

**建议**：

- 使用密码管理器保存主密码
- 定期备份 Arweave 密钥文件
- 考虑使用助记词备份方案

### Q5: 上传的文件大小有限制吗？

- **技术限制**：理论上没有严格的大小限制
- **实际限制**：受账户余额限制，文件越大费用越高
- **建议**：上传前确保账户有足够余额

### Q6: 可以批量上传吗？

目前版本不支持批量上传，需要逐个文件上传。未来版本可能会添加批量上传功能。

### Q7: 支持断点续传和进度显示吗？

- **进度显示**：支持。上传界面会显示详细的阶段（准备/压缩/加密/签名/上传）以及数据传输的百分比进度。
- **断点续传**：
  - **支持会话内自动续传**：上传过程中若网络不稳定，系统会自动重试失败的分片，实现无感续传。
  - **不支持跨会话续传**：如果关闭了浏览器标签页或刷新了页面，内存中的加密状态和交易信息会丢失，必须重新开始上传。

### Q8: 上传失败会扣费吗？

- **基本不会**：Arweave 的机制是数据成功上链存储才收费。
- 如果上传过程中断（数据未完整发送到网络），矿工无法打包该交易，因此不会扣除您的 AR 余额（除极少量的网络交互损耗外，主要的存储费用不会被扣除）。

---

## 安全提示

1. **保护主密码**
   - 使用强密码（至少 8 位字符）
   - 不要与他人分享主密码
   - 使用密码管理器保存

2. **备份密钥**
   - 定期备份 Arweave 密钥文件
   - 将备份存储在安全的地方（如加密的云存储或硬件钱包）

3. **加密敏感文件**
   - 对于包含敏感信息的文件，务必启用加密上传
   - 公开上传的文件任何人都可以访问

4. **检查账户余额**
   - 上传前确保账户有足够余额
   - 定期检查账户余额，避免余额不足导致上传失败

5. **验证交易 ID**
   - 上传成功后，保存交易 ID
   - 可以通过交易 ID 在 Arweave 网络上验证文件是否成功上传

---

## 技术支持

如果遇到问题，可以：

1. 查看控制面板的错误提示
2. 检查浏览器控制台的错误信息
3. 参考项目文档：`docs/` 目录下的其他文档
4. 查看 Arweave 的官方文档

---

## 技术实现细节

### 核心流程

```
用户选择文件
    ↓
检查账户状态（是否解锁、是否有活跃账户）
    ↓
（可选）启用加密 → 使用主密钥加密文件
    ↓
创建 Arweave 交易
    ↓
添加交易标签（Tags）
    ↓
使用 Arweave 密钥签名交易
    ↓
提交交易到 Arweave 网络
    ↓
保存上传记录到本地数据库
    ↓
返回交易 ID（Transaction ID）
```

### 详细步骤

#### 步骤 1: 文件选择与读取

用户通过文件选择器选择要上传的文件，系统使用 `FileReader` API 将文件读取为 `ArrayBuffer`：

```typescript
const reader = new FileReader()
reader.readAsArrayBuffer(file)
reader.onload = async () => {
  const data = new Uint8Array(reader.result as ArrayBuffer)
  // 继续处理...
}
```

**位置**: `src/lib/storage.ts` - `uploadToArweave()` 函数

#### 步骤 2: 可选加密处理

如果用户启用了端到端加密，系统会使用主密钥对文件数据进行加密：

```typescript
if (encryptionKey) {
  const { ciphertext, nonce } = await encryptData(data, encryptionKey)
  data = ciphertext
  encryptionInfo = {
    algo: "XChaCha20-Poly1305",
    params: JSON.stringify({ nonce: toBase64(nonce) }),
  }
}
```

**加密算法**: XChaCha20-Poly1305（使用 libsodium）

**位置**: `src/lib/crypto.ts` - `encryptData()` 函数

#### 步骤 3: 创建 Arweave 交易

使用 Arweave SDK 创建交易对象：

```typescript
const transaction = await arweave.createTransaction({ data }, key)
```

**位置**: `src/lib/storage.ts` - `uploadToArweave()` 函数

#### 步骤 4: 添加交易标签（Tags）

Arweave 交易支持添加元数据标签，用于标识和检索数据：

```typescript
transaction.addTag(
  "Content-Type",
  encryptionKey ? "application/octet-stream" : file.type,
)
transaction.addTag("App-Name", "Aryxn")
transaction.addTag("File-Name", file.name)
transaction.addTag("Owner-Address", ownerAddress)
if (encryptionInfo) {
  transaction.addTag("Encryption-Algo", encryptionInfo.algo)
  transaction.addTag("Encryption-Params", encryptionInfo.params)
}
```

**标签说明**:

- `Content-Type`: 文件 MIME 类型（加密文件使用 `application/octet-stream`）
- `App-Name`: 应用标识（固定为 "Aryxn"）
- `File-Name`: 原始文件名
- `Owner-Address`: 账户地址（用于文件同步）
- `Encryption-Algo`: 加密算法（如果启用加密）
- `Encryption-Params`: 加密参数（JSON 字符串，包含 nonce 的 base64 编码）

#### 步骤 5: 签名交易

使用 Arweave 密钥对交易进行签名：

```typescript
await arweave.transactions.sign(transaction, key)
```

签名后的交易包含：

- 交易 ID（Transaction ID）
- 签名信息
- 所有标签和数据

#### 步骤 6: 提交交易

将签名后的交易提交到 Arweave 网络：

```typescript
const response = await arweave.transactions.post(transaction)
```

**网络配置**:

- Host: `arweave.net`
- Port: `443`
- Protocol: `https`

**响应处理**:

- 状态码 200: 上传成功
- 其他状态码：上传失败，抛出错误

#### 步骤 7: 保存上传记录

上传成功后，将交易信息保存到本地 SQLite 数据库：

```typescript
const address = await arweave.wallets.jwkToAddress(key)
await db.run(
  `INSERT INTO file_indexes (
    id, tx_id, file_name, file_hash, file_size, mime_type,
    folder_id, description, owner_address, storage_type,
    encryption_algo, encryption_params, version, previous_tx_id,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [fileId, transaction.id, file.name, fileHash, file.size, file.type, ...]
)
```

**位置**: `src/lib/storage.ts` - `uploadToArweave()` 函数  
**数据库**: `src/lib/sqlite-db.ts` - SQLite WASM

### 相关代码

#### 核心文件

1. **上传逻辑**: `src/lib/storage.ts`
   - `uploadToArweave()`: 主要上传函数
   - `generateArweaveWallet()`: 生成新账户
   - `arweave`: Arweave 客户端实例

2. **加密逻辑**: `src/lib/crypto.ts`
   - `encryptData()`: 加密数据
   - `decryptData()`: 解密数据
   - `deriveKey()`: 密钥派生

3. **数据库**: `src/lib/sqlite-db.ts`
   - `db`: SQLite 数据库操作接口

4. **UI 组件**: `src/pages/Upload.tsx`
   - `UploadPage`: 上传页面组件
   - `onUploadArweave()`: 上传处理函数

### 关键函数调用链

```
UploadPage.onUploadArweave()
    ↓
storage.uploadToArweave(file, key, encryptionKey?)
    ↓
FileReader.readAsArrayBuffer(file)
    ↓
crypto.encryptData(data, encryptionKey) [可选]
    ↓
arweave.createTransaction({ data }, key)
    ↓
transaction.addTag(...)
    ↓
arweave.transactions.sign(transaction, key)
    ↓
arweave.transactions.post(transaction)
    ↓
db.run("INSERT INTO file_indexes ...")
```

## 相关文档

- [设计文档](./design.md)
- [实现文档](./implementation.md)
- [文件同步机制](./file-sync.md)

---

**最后更新**：2025 年 1 月
