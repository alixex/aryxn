# 实施指南

## 快速开始

### 1. 安装依赖

```bash
pnpm add @sqlite.org/sqlite-wasm
```

**注意**：我们使用官方的 `@sqlite.org/sqlite-wasm` 而不是 `sql.js`，以获得更好的性能和官方支持。

### 2. 配置 Vite 和 HTML

#### 2.1 更新 `vite.config.ts`

```typescript
export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
})
```

#### 2.2 安装 coi-serviceworker

```bash
pnpm add coi-serviceworker
```

**注意**：`package.json` 中已配置 `postinstall` 脚本，安装依赖后会自动将 `coi-serviceworker.min.js` 复制到 `public/` 目录。

#### 2.3 更新 `index.html`

在 `<head>` 中添加 coi-serviceworker（用于 GitHub Pages 等不支持自定义 headers 的环境）：

```html
<head>
  <!-- coi-serviceworker for Cross-Origin Isolation (required for OPFS) -->
  <script src="/coi-serviceworker.min.js"></script>
</head>
```

### 3. 初始化 SQLite 数据库

创建 `src/lib/sqlite-db.ts`：

```typescript
import init from "@sqlite.org/sqlite-wasm"

// 扩展 globalThis 类型以包含 sqlite3Worker1Promiser
declare global {
  var sqlite3Worker1Promiser:
    | ((config: {
        onready: (promiserFunc: (...args: any[]) => Promise<any>) => void
        onerror?: (...args: any[]) => void
      }) => (...args: any[]) => Promise<any>)
    | undefined
}

let dbPromiser: any = null
let dbId: number | null = null

export async function initDatabase(): Promise<void> {
  if (dbPromiser && dbId !== null) {
    return
  }

  // 先导入模块以初始化 globalThis.sqlite3Worker1Promiser
  await init()

  // 从 globalThis 获取 sqlite3Worker1Promiser
  const sqlite3Worker1Promiser = globalThis.sqlite3Worker1Promiser
  if (!sqlite3Worker1Promiser) {
    throw new Error("sqlite3Worker1Promiser not found on globalThis")
  }

  // 创建 promiser（使用 wrapped worker）
  dbPromiser = await new Promise((resolve, reject) => {
    const promiser = sqlite3Worker1Promiser({
      onready: () => resolve(promiser),
      onerror: (err: any) => reject(err),
    })
  })

  // 打开数据库（使用 OPFS 如果可用）
  const openResponse = await dbPromiser("open", {
    filename: "file:aryxn.db?vfs=opfs",
  })

  dbId = openResponse.dbId

  // 创建表结构
  await createTables()
}

async function createTables(): Promise<void> {
  if (!dbPromiser || dbId === null) {
    throw new Error("Database not initialized")
  }

  // 创建所有表和索引（使用 IF NOT EXISTS）
  await dbPromiser("exec", {
    dbId,
    sql: `
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        owner_address TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES folders(id)
      );
      
      CREATE TABLE IF NOT EXISTS file_indexes (
        id TEXT PRIMARY KEY,
        tx_id TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        folder_id TEXT,
        description TEXT,
        owner_address TEXT NOT NULL,
        storage_type TEXT NOT NULL,
        encryption_algo TEXT NOT NULL,
        encryption_params TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        previous_tx_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES folders(id)
      );
      
      CREATE TABLE IF NOT EXISTS file_tags (
        file_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (file_id, tag),
        FOREIGN KEY (file_id) REFERENCES file_indexes(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS index_manifests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_id TEXT UNIQUE NOT NULL,
        owner_address TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_address);
      CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
      CREATE INDEX IF NOT EXISTS idx_file_owner ON file_indexes(owner_address);
      CREATE INDEX IF NOT EXISTS idx_file_folder ON file_indexes(folder_id);
      CREATE INDEX IF NOT EXISTS idx_file_hash ON file_indexes(file_hash);
      CREATE INDEX IF NOT EXISTS idx_file_created ON file_indexes(created_at);
      CREATE INDEX IF NOT EXISTS idx_file_name ON file_indexes(file_name);
      CREATE INDEX IF NOT EXISTS idx_tags_file ON file_tags(file_id);
      CREATE INDEX IF NOT EXISTS idx_tags_tag ON file_tags(tag);
      CREATE INDEX IF NOT EXISTS idx_manifest_owner ON index_manifests(owner_address);
      CREATE INDEX IF NOT EXISTS idx_manifest_created ON index_manifests(created_at);
      
      CREATE VIRTUAL TABLE IF NOT EXISTS file_indexes_fts USING fts5(
        id UNINDEXED,
        file_name,
        description,
        content='file_indexes',
        content_rowid='rowid'
      );
    `,
  })
}

// 数据库操作封装
// 注意：所有方法都使用参数化查询，防止 SQL 注入
export const db = {
  // 执行查询，返回单条记录
  async get(sql: string, params: any[] = []): Promise<any> {
    await initDatabase()
    if (!dbPromiser || dbId === null) {
      throw new Error("Database not initialized")
    }

    // 使用 prepare 进行参数化查询
    const prepareResult = await dbPromiser("prepare", { dbId, sql })
    const stmtId = prepareResult.result.stmtId

    try {
      if (params.length > 0) {
        await dbPromiser("bind", { dbId, stmtId, bind: params })
      }

      const stepResult = await dbPromiser("step", { dbId, stmtId })

      if (stepResult.result.row) {
        const getResult = await dbPromiser("get", {
          dbId,
          stmtId,
          returnValue: "resultRows",
          rowMode: "object",
        })
        return getResult.result.resultRows[0] || null
      }

      return null
    } finally {
      await dbPromiser("finalize", { dbId, stmtId })
    }
  },

  // 执行查询，返回多条记录
  async all(sql: string, params: any[] = []): Promise<any[]> {
    await initDatabase()
    if (!dbPromiser || dbId === null) {
      throw new Error("Database not initialized")
    }

    const prepareResult = await dbPromiser("prepare", { dbId, sql })
    const stmtId = prepareResult.result.stmtId

    try {
      if (params.length > 0) {
        await dbPromiser("bind", { dbId, stmtId, bind: params })
      }

      const rows: any[] = []
      while (true) {
        const stepResult = await dbPromiser("step", { dbId, stmtId })
        if (!stepResult.result.row) break

        const getResult = await dbPromiser("get", {
          dbId,
          stmtId,
          returnValue: "resultRows",
          rowMode: "object",
        })

        if (getResult.result.resultRows.length > 0) {
          rows.push(getResult.result.resultRows[0])
        }
      }

      return rows
    } finally {
      await dbPromiser("finalize", { dbId, stmtId })
    }
  },

  // 执行更新/插入/删除操作
  async run(sql: string, params: any[] = []): Promise<void> {
    await initDatabase()
    if (!dbPromiser || dbId === null) {
      throw new Error("Database not initialized")
    }

    const prepareResult = await dbPromiser("prepare", { dbId, sql })
    const stmtId = prepareResult.result.stmtId

    try {
      if (params.length > 0) {
        await dbPromiser("bind", { dbId, stmtId, bind: params })
      }

      await dbPromiser("step", { dbId, stmtId })
    } finally {
      await dbPromiser("finalize", { dbId, stmtId })
    }
  },

  // 执行多条 SQL 语句（用于事务和 DDL）
  async exec(sql: string): Promise<void> {
    await initDatabase()
    if (!dbPromiser || dbId === null) {
      throw new Error("Database not initialized")
    }

    await dbPromiser("exec", { dbId, sql })
  },
}
```

### 4. 创建文件管理模块

创建 `src/lib/file-manager.ts`，实现统一的文件管理接口（参考 `design.md` 中的代码示例）。

主要功能包括：

- `uploadFile()` - 上传文件并创建索引
- `searchFiles()` - 搜索文件（支持全文搜索、标签、文件夹筛选）
- `updateFileMetadata()` - 更新文件元数据
- `updateFileContent()` - 更新文件内容（创建新版本）
- `createFolder()` - 创建文件夹
- `getFolderTree()` - 获取文件夹树

### 5. 数据迁移

从现有的 IndexedDB 迁移到 SQLite：

```typescript
// src/lib/migrate.ts
import { db as indexedDb } from "./db"
import { db as sqliteDb } from "./sqlite-db"

export async function migrateFromIndexedDB() {
  // 迁移上传记录
  const uploads = await indexedDb.uploads.toArray()

  for (const upload of uploads) {
    const fileId = crypto.randomUUID()
    await sqliteDb.run(
      `
      INSERT INTO file_indexes (
        id, tx_id, file_name, file_hash, file_size, mime_type,
        folder_id, description, owner_address, storage_type,
        encryption_algo, encryption_params, version, previous_tx_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        fileId,
        upload.txId,
        upload.fileName,
        upload.fileHash || "",
        0,
        "application/octet-stream",
        null,
        null,
        upload.ownerAddress,
        upload.storageType,
        upload.encryptionAlgo,
        upload.encryptionParams,
        1,
        null,
        upload.createdAt,
        upload.createdAt,
      ],
    )
  }

  console.log(`Migrated ${uploads.length} files`)
}
```

### 6. 更新上传函数

修改 `src/lib/storage.ts`，移除数据库操作（由 `file-manager.ts` 处理）：

```typescript
// uploadToArweave 现在只负责上传到 Arweave
// 数据库操作由 file-manager.ts 中的 uploadFile 函数处理
```

### 7. 更新 UI 组件

更新 `src/pages/Upload.tsx` 和 `src/pages/Dashboard.tsx`，使用新的文件管理接口：

```typescript
import { uploadFile, searchFiles } from "@/lib/file-manager"

// 上传文件
const { txId, fileId } = await uploadFile(file, address, key, {
  folderId: folderId,
  tags: ["tag1", "tag2"],
  description: "File description",
})

// 搜索文件
const results = await searchFiles(address, {
  query: "search term",
  tags: ["tag1"],
  limit: 10,
})
```

## 实施步骤

1. ✅ 安装 `@sqlite.org/sqlite-wasm` 依赖
2. ✅ 配置 Vite 和 HTML（添加 COOP/COEP headers 和 coi-serviceworker）
3. ✅ 创建数据库初始化代码（使用 OPFS）
4. ✅ 实现文件管理模块（上传、搜索、修改）
5. ✅ 数据迁移（从 IndexedDB 到 SQLite）
6. ✅ 更新 storage.ts 移除数据库操作
7. ✅ 更新 UI 组件使用新的文件管理接口
8. ✅ 测试和优化

## 技术选型说明

### 为什么选择 @sqlite.org/sqlite-wasm 而不是 sql.js？

1. **官方支持**：由 SQLite 官方团队维护，长期支持更有保障
2. **性能更好**：支持 OPFS，性能接近原生 SQLite
3. **功能完整**：提供多种 API（Worker API、OO API 等）
4. **更新及时**：跟随 SQLite 版本更新

### coi-serviceworker 的作用

在 GitHub Pages 等不支持自定义 HTTP headers 的环境，`coi-serviceworker` 通过 Service Worker 模拟跨源隔离，使 OPFS 能够正常工作。

## 注意事项

1. **数据库持久化**：
   - 使用 **OPFS (Origin Private File System)** 进行高性能持久化
   - 如果 OPFS 不可用，会自动回退到内存模式
   - 通过 `coi-serviceworker` 在 GitHub Pages 等环境支持 OPFS

2. **跨源隔离**：
   - OPFS 需要跨源隔离（Cross-Origin Isolation）
   - 开发环境：Vite 自动设置 COOP/COEP headers
   - 生产环境（GitHub Pages）：使用 `coi-serviceworker` 模拟跨源隔离
   - 验证：检查 `window.crossOriginIsolated` 是否为 `true`

3. **事务处理**：使用事务确保数据一致性

4. **错误处理**：妥善处理数据库操作错误

5. **性能优化**：
   - 使用 OPFS 获得接近原生 SQLite 的性能
   - 使用索引和分页查询
   - FTS5 全文搜索索引

6. **向后兼容**：保留 IndexedDB 表（Dexie），通过迁移工具逐步迁移

7. **SQL 注入防护**：
   - ✅ 所有用户输入都通过参数化查询传递（使用 `bind` 参数）
   - ✅ 字段名使用白名单验证，不直接使用用户输入
   - ✅ DDL 语句（CREATE TABLE 等）不使用用户输入
   - ❌ 禁止直接拼接用户输入到 SQL 字符串中

8. **Worker API**：
   - 使用 `sqlite3Worker1Promiser` 的 wrapped worker 模式
   - 数据库操作在 Worker 中执行，不阻塞主线程

## 测试

```typescript
// 测试文件上传
const { txId, fileId } = await uploadFile(file, address, key, {
  folderId: folderId,
  tags: ["test"],
  description: "Test file",
})

// 测试文件搜索
const results = await searchFiles(address, {
  query: "test",
  tags: ["test"],
  limit: 10,
})

// 测试文件修改
await updateFileMetadata(fileId, {
  fileName: "New Name",
  tags: ["updated"],
})
```
