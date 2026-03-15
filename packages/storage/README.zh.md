# @aryxn/storage

Aryxn 的纯净 SQLite 与 OPFS (Origin Private File System) 持久化集成库。该包负责数据库初始化和文件系统交互，但**不**包含具体的业务表结构定义。

## 功能特性

- **OPFS 持久化**: 自动将 SQLite 数据库与浏览器的高性能私有文件系统同步。
- **纯粹抽象**: 提供通用的 `db` 对象和 SQL 执行辅助函数。
- **结构无关 (Schema-Agnostic)**: 允许应用层在 `initDatabase` 中定义表结构和迁移逻辑。

## API 参考

| 元素                           | 说明                                                           |
| :----------------------------- | :------------------------------------------------------------- |
| `initDatabase(onReady?)`       | 初始化 SQLite 数据库与 OPFS 桥接。接受可选回调用于表结构设置。 |
| `db.exec(sql, bind?)`          | 执行 SQL 语句 (INSERT, UPDATE, DELETE)。                       |
| `db.selectObjects(sql, bind?)` | 执行 SELECT 查询并返回对象数组。                               |
| `db.selectValues(sql, bind?)`  | 执行 SELECT 查询并返回值的数组。                               |
| `listOpfsFiles()`              | 列出当前 OPFS 存储的所有文件。                                 |

## 使用示例

```typescript
import { initDatabase, db } from "@aryxn/storage"

// 初始化并传入回调以应用表结构
await initDatabase(async () => {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)",
  )
})

// 执行查询
const result = await db.selectObjects("SELECT * FROM users")
```
