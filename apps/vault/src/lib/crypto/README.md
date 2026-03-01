# Cryptographic Operations

加密和安全相关的功能，包括数据加密/解密和密钥管理。

## 目录结构

```
crypto/
├── crypto.ts                  # 加密/解密和密钥操作
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `crypto.ts`

提供加密操作，包括 AES 加密、密钥派生和数据编码。

```typescript
import { encryptData, decryptData } from "@/lib/crypto"

// 加密
const { ciphertext, nonce } = await encryptData(data, masterKey)

// 解密
const decrypted = await decryptData(ciphertext, nonce, masterKey)
```

## 主要功能

### 数据加密

```typescript
import { encryptData } from "@/lib/crypto"

const data = new Uint8Array([1, 2, 3, 4, 5])
const masterKey = new Uint8Array(32) // 256-bit key

const encrypted = await encryptData(data, masterKey)
// => { ciphertext: Uint8Array, nonce: Uint8Array }
```

### 数据解密

```typescript
import { decryptData } from "@/lib/crypto"

const decrypted = await decryptData(
  encrypted.ciphertext,
  encrypted.nonce,
  masterKey,
)
// => Uint8Array(original data)
```

### 密钥派生

```typescript
import { deriveKey } from "@/lib/crypto"

const masterKey = new Uint8Array(32)
const derivedKey = await deriveKey(masterKey, "hmac-sha256")
```

### 数据编码转换

```typescript
import { toBase64, fromBase64, toBytes, fromBytes } from "@/lib/crypto"

// Base64 编码/解码
const encoded = toBase64(uint8array)
const decoded = fromBase64(encoded)

// 字节转换
const bytes = toBytes(jsonString)
const str = fromBytes(bytes)
```

## 使用场景

### 场景 1: 加密敏感数据存储

```typescript
import { encryptData, toBase64 } from "@/lib/crypto"

const sensitiveData = { privateKey: "..." }
const { ciphertext, nonce } = await encryptData(
  toBytes(JSON.stringify(sensitiveData)),
  masterKey,
)

// 存储到数据库
db.save({
  encrypted_data: toBase64(ciphertext),
  nonce: toBase64(nonce),
})
```

### 场景 2: 解密检索的数据

```typescript
import { decryptData, fromBase64, fromBytes } from "@/lib/crypto"

const stored = db.get(id)
const decrypted = await decryptData(
  fromBase64(stored.encrypted_data),
  fromBase64(stored.nonce),
  masterKey,
)
const original = JSON.parse(fromBytes(decrypted))
```

### 场景 3: 批量加密操作

```typescript
const items = [item1, item2, item3]
const encrypted = await Promise.all(
  items.map((item) => encryptData(toBytes(JSON.stringify(item)), masterKey)),
)
```

## API 参考

### `encryptData(data, key)`

- **参数：**
  - `data`: `Uint8Array` - 要加密的数据
  - `key`: `Uint8Array` - 加密密钥（32 字节）
- **返回：** `Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }>`

### `decryptData(ciphertext, nonce, key)`

- **参数：**
  - `ciphertext`: `Uint8Array` - 密文
  - `nonce`: `Uint8Array` - 随机数
  - `key`: `Uint8Array` - 解密密钥
- **返回：** `Promise<Uint8Array>` - 解密后的数据

### `deriveKey(masterKey, algorithm?)`

- **参数：**
  - `masterKey`: `Uint8Array` - 主密钥
  - `algorithm`: `string` - 派生算法（默认 "hmac-sha256"）
- **返回：** `Promise<Uint8Array>` - 派生的密钥

### 编码转换

```typescript
toBase64(data: Uint8Array): string
fromBase64(encoded: string): Uint8Array
toBytes(str: string): Uint8Array
fromBytes(bytes: Uint8Array): string
```

## 安全考虑

- ⚠️ 所有加密操作都是**异步**的，确保不阻塞 UI
- ⚠️ 密钥应该来自安全的源（如 Vault 派生）
- ⚠️ Nonce 必须与密文一起存储才能解密
- ⚠️ 不要在日志中打印密钥或敏感数据

## 依赖关系

- `@aryxn/crypto` - 底层加密实现
- Web Crypto API - 浏览器原生加密支持

## 设计原则

- **异步操作**: 所有加密操作都返回 Promise
- **类型安全**: 严格的 Uint8Array 类型检查
- **零信任**: 所有输入都需要验证
- **标准化**: 使用业界标准的 AEAD（AES-GCM）
