# Database Layer

SQLite 数据库操作和 Vault 专用的数据库管理。

## 目录结构

```
database/
├── sqlite-db.ts               # SQLite 连接和操作
├── vault/                     # Vault 数据库模块
│   ├── db.ts                  # Vault DB 初始化
│   ├── schema.ts              # 数据库 Schema 定义
│   └── diagnostics.ts         # 诊断工具
├── index.ts                   # 统一导出
└── README.md                  # 本文件
```

## 核心模块

### `sqlite-db.ts`

SQLite 数据库的全局连接点。

```typescript
import { db } from "@/lib/database"

// 查询
const rows = await db.all("SELECT * FROM wallets WHERE vault_id = ?", [vaultId])

// 插入
await db.run("INSERT INTO wallets (address, chain) VALUES (?, ?)", [
  address,
  chain,
])

// 单行查询
const wallet = await db.get("SELECT * FROM wallets WHERE address = ?", [
  address,
])
```

### `vault/schema.ts`

定义数据库表结构和初始化逻辑。

```typescript
import { initializeVaultSchema } from "@/lib/database"

// 自动创建所有必要的表
await initializeVaultSchema()
```

**表结构：**

- `wallets` - 钱包记录
- `vaults` - 金库元数据
- `file_index` - 文件索引
- `upload_history` - 上传历史

### `vault/db.ts`

Vault 特定的数据库操作。

```typescript
import { createVaultDbOps } from "@/lib/database"

const vaultOps = createVaultDbOps(vaultId)
```

### `vault/diagnostics.ts`

数据库诊断和修复工具。

```typescript
import { diagnoseDatabase, repairDatabase } from "@/lib/database"

// 检查数据库完整性
const issues = await diagnoseDatabase()

// 修复常见问题
await repairDatabase()
```

## 使用示例

### 场景 1: 查询钱包

```typescript
import { db } from "@/lib/database"

const wallets = await db.all(
  `SELECT address, chain, alias FROM wallets 
   WHERE vault_id = ? AND deleted_at IS NULL`,
  [vaultId],
)
```

### 场景 2: 插入新钱包

```typescript
import { db } from "@/lib/database"

await db.run(
  `INSERT INTO wallets 
   (address, encrypted_key, alias, chain, vault_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [address, encryptedKey, alias, chain, vaultId, Date.now()],
)
```

### 场景 3: 软删除

```typescript
await db.run("UPDATE wallets SET deleted_at = ? WHERE address = ?", [
  Date.now(),
  address,
])
```

### 场景 4: 事务操作

```typescript
import { db } from "@/lib/database"

try {
  await db.run("BEGIN TRANSACTION")

  // 多个操作
  await db.run("INSERT INTO wallets ...")
  await db.run("UPDATE vaults ...")

  await db.run("COMMIT")
} catch (error) {
  await db.run("ROLLBACK")
  throw error
}
```

## API 参考

### `db.all(sql, params?)`

执行 SELECT 查询，返回所有行。

```typescript
const rows = await db.all("SELECT * FROM wallets WHERE chain = ?", ["ethereum"])
// => DbRow[]
```

### `db.get(sql, params?)`

执行 SELECT 查询，返回单行。

```typescript
const wallet = await db.get("SELECT * FROM wallets WHERE address = ?", [addr])
// => DbRow | undefined
```

### `db.run(sql, params?)`

执行 INSERT/UPDATE/DELETE 操作。

```typescript
const result = await db.run("UPDATE wallets SET alias = ? WHERE address = ?", [
  newAlias,
  address,
])
// => { changes: number, lastID: number }
```

### `db.exec(sql)`

执行多条语句（用于初始化！）。

```typescript
await db.exec(`
  CREATE TABLE IF NOT EXISTS wallets (...)
  CREATE INDEX IF NOT EXISTS idx_vault ON wallets(vault_id)
`)
```

## 数据库设计原则

### 1. 列类型

```sql
-- 字符串
address TEXT NOT NULL PRIMARY KEY
alias TEXT

-- 数字
created_at INTEGER NOT NULL
balance REAL

-- JSON
encrypted_key TEXT -- 存储 JSON 字符串

-- 布尔值
is_active INTEGER DEFAULT 1 -- 0 or 1
```

### 2. 索引策略

```sql
-- 主键
PRIMARY KEY (address)

-- 外键
FOREIGN KEY (vault_id) REFERENCES vaults(id)

-- 查询索引
CREATE INDEX idx_vault ON wallets(vault_id)
CREATE INDEX idx_chain ON wallets(chain)
```

### 3. 软删除

```sql
-- 不直接删除，而是标记
deleted_at INTEGER DEFAULT NULL

-- 查询时过滤
WHERE deleted_at IS NULL
```

## 最佳实践

✅ **推荐**

```typescript
// 使用参数化查询防止 SQL 注入
await db.run("SELECT * FROM wallets WHERE address = ?", [address])

// 使用事务处理多个相关操作
await db.run("BEGIN")
try {
  // 多个操作
  await db.run("COMMIT")
} catch {
  await db.run("ROLLBACK")
}

// 软删除而非硬删除
await db.run("UPDATE wallets SET deleted_at = ? WHERE id = ?", [date, id])
```

❌ **不推荐**

```typescript
// 字符串拼接导致 SQL 注入
await db.run(`SELECT * FROM wallets WHERE address = '${address}'`)

// 忽略错误
await db.run("INSERT INTO wallets ...") // 没有 try-catch

// 硬删除丢失数据
await db.run("DELETE FROM wallets WHERE ...")
```

## 依赖关系

- `@aryxn/storage` - 数据库接口定义
- SQLite 3 - 通过 sql.js 或原生驱动

## 设计原则

- **原子性**: 所有操作要么全部成功，要么全部失败
- **可审计性**: 软删除保留历史数据
- **性能**: 关键查询都有索引
- **安全**: 参数化查询防止注入
