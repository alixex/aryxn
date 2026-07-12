# 资源索引设计（Resource Index Design）

- **Date**: 2026-07-12
- **Status**: Approved (design)，分层实施
- **Scope**: `apps/link`，与 [multi-account-design.md](./multi-account-design.md) 配套
- **前置变更**: 本地层已从 **SQLite 换成 IndexedDB**。当前用 `@alixex/storage` 的
  KV 接口（`idbGet/idbSet/idbDel/idbKeys/idbValues/idbClear`），搜索是对
  `idbValues()` 的内存过滤，不再有 SQLite 的表/游标/全文索引。

---

## 1. 背景：Arweave/Irys 上「tag 就是索引」

Arweave / Irys 数据**不可变、不可删改**，且**没有原生的「列出我的文件」接口**。要把
「属于这个 app、属于我」的交易挑出来，唯一办法是靠**上传时打的 tag + 发起地址**。

**契约**：每次上传写死 `App-Name: Aryxn`（+ `File-Name` / `Content-Type` /
`Encrypted`）。查询时 `owner AND App-Name` 让网关把散落的交易聚合回来：

```
owners = 谁传的（身份）  ← AR 用 Arweave 地址；Irys 用 EVM 付费地址
tags   = 属于哪个 app    ← App-Name=Aryxn（全局常量，所有用户共用）
两个 AND = 「我的、这个 app 的」文件
```

> `App-Name=Aryxn` 是全局常量，光靠它会查到**所有用户**的上传；必须叠加 `owners`
> 才缩到自己。

由此推出的铁律：

| 现象                   | 原因                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| 改 `App-Name` 就丢历史 | 老文件带老 tag，换了查不到 → **死守 `APP_NAME="Aryxn"`** 契约    |
| 文件名泄露             | tag 公开可查，`File-Name` 打明文谁都能看到                       |
| tag 装不下富元数据     | Arweave tag 总大小有上限（~2KB），装不下文件夹/排序/富信息       |
| 无中心索引             | 没有「索引文件」；散落在每笔交易上的 tag，被网关按需聚合就是索引 |

---

## 2. 当前策略：发现（联网）+ 搜索（本地），是两件事

**当前 slim app**（`storage.ts` + `cache.ts`）把「搜索」拆成两步：

**Step 1 — 发现/列表（联网，每链一次 GraphQL tag 查询）**。两链共用 Arweave 的
GraphQL schema，查询同款，但**两条路径并不对称**：

| 维度        | Arweave (`listArweaveByOwner`)                       | Irys (`listIrysByOwner`)                       |
| ----------- | ---------------------------------------------------- | ---------------------------------------------- |
| 索引器/端点 | `AR_GRAPHQL`（arweave.net 网关）                     | `IRYS_GRAPHQL`（**另一个索引器**）             |
| 查询        | `tags:[App-Name=Aryxn], first:100, sort:HEIGHT_DESC` | 同款但**无 sort**（靠默认序）                  |
| owner 身份  | **Arweave 地址**（`address()`）                      | **EVM 付费地址**（`getConnectedEvmAddress()`） |
| size        | 有（`data.size`）                                    | **取不到 → 硬编码 0**                          |
| timestamp   | `block.timestamp × 1000`；未确认 `block:null → 0`    | 已是毫秒                                       |
| 确认性      | 区块确认 + 网关索引延迟（分钟级）                    | L1 快终局 + 自有索引                           |

**Step 2 — 搜索（本地，永不联网）**：`filterLinks` 对 `cachedAssets()`（IndexedDB）
做**内存子串匹配、仅 fileName、大小写不敏感**，`createEffect` 响应式即时刷新。
**搜索完全不打网络** → 「文件多了搜索慢」在这套里不成立，慢只可能在 Step 1。

**合并**（`refreshLinks`）：先显示缓存 → 查 AR（AR 地址）→ 缓存 → 查 Irys（EVM
地址）→ 缓存 → 按 timestamp 倒序重读。两条各自 try/catch，一条抽风不影响另一条；
缓存键 `link:<txId>` 天然去重。

**当前策略的 4 个真实缺口：**

1. **first:100 封顶、无分页** → 新设备/清缓存后看不到第 100 条以外的旧文件（唯一
   的真 bug，P1 解决）。
2. **Irys size=0** → 跨设备对账回来的 Irys 文件显示「0 B」（上传当次缓存有真值，
   跨设备丢失）。
3. **双地址割裂** → AR 文件按 AR 地址查、Irys 按 EVM 地址查；只连一个身份就看不到
   另一条链的文件。「我的链接」要完整需两个身份都连上。
4. **搜索是本地-only** → 是优点（秒回、离线、零网关依赖）也是局限（只能搜已进缓存
   的、只按 fileName）。跨设备搜全量得先把列表同步全（回到缺口 1）。

---

## 3. 旧清单架构回顾（归档 `archive/full-suite-2026-07-12`）

老 vault 用的是**版本化增量链表清单**（`manifest-updater.ts` + `file-sync.ts`）：

```
清单3 ──prev──> 清单2 ──prev──> 清单1 ──prev──> null
 +文件21-30      +文件11-20      +文件1-10（首份含全部）
```

- **写入**：`IncrementalManifest{ version, ownerAddress, previousManifestTxId,
added[], updated[], deleted[] }`，只装差量；tag `App-Name: Aryxn-Manifest`。
- **找 head**：GraphQL `App-Name=Aryxn-Manifest` + owner + `HEIGHT_DESC first:1`。
- **读取重建**：`mergeManifestChain` 下载 head → 顺 `previousManifestTxId` 遍历 →
  按 tx_id 合并 added/updated/deleted → 完整列表 → 同步本地 → 本地搜索。
- **批量调度**：防抖（≥20 立即、否则 10s 批量、最多 50），减少清单 tx 数 = 省钱。
- **成本**：增量 vs 全量快照，文档账为 1000 文件 / 100 次更新 $1.00 → $0.01。

---

## 4. Review：清单的本质与三笔债

**本质**：清单 = 覆盖不可变数据的**可变视图**（删除 / 改名 / 文件夹 / 排序）。这是
标签查询**永远做不到**的（tag 上传即焊死）。**它主要为「管理」而非「查询加速」设计，
增量链表只是省钱手段。**

**三笔债**（旧设计自身欠的，直接削弱了它的立意）：

1. **找 head 仍是一次标签查询** → **没脱离网关/索引器依赖**；索引器延迟就可能拿到
   旧 head、漏最新清单。跟直接查文件 tag 依赖同一个 GraphQL 索引器。
2. **冷启动读 = O(链长) 串行请求**（`while` 里逐个 `await`）；批量只减清单数、**不
   封顶链长**，无 compaction/快照 → 长链后冷读比分页标签查询还慢。把写成本换成了读
   成本。
3. **明文 JSON 上链**（`application/json` Blob）→ **元数据（文件名等）照样公开**，
   隐私问题并没解决。

外加：**一致性窗口**（防抖期间关页面 → 文件传了但不在清单，重试记录在内存、刷新即
失 → 仍需标签查询兜底）、**每批真实成本**（清单 tx 要花钱；99% 是增量 vs 全量，不是
清单 vs 不用清单）、**复杂度**（slim 重写砍的就是这坨）、**多账户 ×N**。

---

## 5. 决策：三档需求，前两档都用不到链上索引

| 想要的能力                      | 需要链上索引？ | 怎么做最好                                          |
| ------------------------------- | -------------- | --------------------------------------------------- |
| **列出 + 搜索文件**             | ❌ 不需要      | tag 查询 + 分页 + 水位 + IndexedDB 缓存 + 内存搜索  |
| **单设备管理**（删/改名/夹/序） | ❌ 不需要      | 管理状态存**本地 IndexedDB override**，叠加在结果上 |
| **跨设备 + 私密的管理**         | ✅ 仅此一档    | 加密清单上链（还三债）                              |

**关键洞察**：连「管理」都不必上链。删除/改名/文件夹/排序完全可以**只存本地**
（IndexedDB 加 `hidden/displayName/folder/order` 字段），覆盖在链上 tag 查询之上——
本机就能删能改能整理，一行链上写入都不用。**只有「A 设备改的 B 设备也要同步、且元
数据不能公开」**这一个场景，才轮到加密清单上链。

**为什么链上索引对当前产品意义不大**：① 加速查询？不——搜索本就在本地；② 加速列
表？不——分页+水位后日常 ≈1 请求，聚合清单唯一快的冷启动场景要每次上传永久付费；
③ 抗网关故障？不——head 还得靠 tag 查询找，没真正脱离网关；④ 省心？反而更复杂。它
唯一不可替代的只有 **①可变管理 ②私密元数据**，而这俩一个能本地做、一个是高级需求。

---

## 6. 本地层（IndexedDB，替代 SQLite）

- KV store，键 `link:<txId>`，value = `AssetRecord` + 可选**管理字段**
  （`hidden` / `displayName` / `folder` / `order`）。
- **搜索** = `idbValues()` 内存过滤（现状 `filterLinks`）。万级记录仍够；真到超大
  规模再考虑 IndexedDB 二级索引 / 游标分页。
- **对账**：标签查询拉链上真值填充；本地管理字段作为**覆盖层（override）**合并出用
  户视图（链上是事实来源，本地只叠加可变视图）。

---

## 7. 分层实施

### P0（立即做）修文件名泄露

加密上传时 `File-Name` **不写明文**（占位 `encrypted` 或省略），真实名放进
`AssetRecord` / 加密内容里。见 `storage.ts` 的 `uploadArweave` L115、`uploadIrys`
L169。

### P1（查询正解）标签查询加分页 + 水位

**分页 = 冷启动能拉全**（修完整性）；**水位 = 热刷新不白拉**（修效率）。

```ts
// 分页：游标循环拉到没有为止（冷启动 / 新设备）
async function listAll(address: string) {
  const out = []
  let cursor: string | null = null
  while (true) {
    const { edges, hasNextPage } = await queryPage(address, cursor) // first:100, after:cursor, HEIGHT_DESC
    out.push(...edges.map(toRecord))
    if (!hasNextPage || !edges.length) break
    cursor = edges.at(-1).cursor
  }
  return out
}

// 水位：HEIGHT_DESC 最新在前，撞到已同步的 txId 就停（稳态 ≈1 请求）
async function sync(address: string) {
  const knownNewest = await getWatermark("arweave", address)
  let cursor: string | null = null,
    first: string | null = null
  outer: while (true) {
    const { edges, hasNextPage } = await queryPage(address, cursor)
    for (const e of edges) {
      first ??= e.node.id
      if (e.node.id === knownNewest) break outer // 撞水位，后面都同步过了
      await cacheAsset(toRecord(e))
    }
    if (!hasNextPage) break
    cursor = edges.at(-1).cursor
  }
  if (first) await setWatermark("arweave", address, first)
}
```

GraphQL 多取两个字段：`pageInfo{ hasNextPage }` 与 `edges{ cursor node{...} }`。

| 场景                  | 行为                 | 请求数        |
| --------------------- | -------------------- | ------------- |
| 首次/新设备（无水位） | 分页拉到底           | O(总数 / 100) |
| 日常刷新（有水位）    | 拉最新页，撞水位即停 | **≈1 次请求** |

**两个必须注意点：**

1. **水位按（链 + 地址）分别存**：`sync:arweave:<arAddr>`、`sync:irys:<evmAddr>`
   （两个独立索引器 + 两种 owner 身份）。存 IndexedDB meta 键即可。
2. **Irys 必须补显式排序**：`listIrysByOwner` 现在**无 sort**（`storage.ts` L250），
   水位依赖「最新在前」，得加按 timestamp/height 降序；AR 已有 `HEIGHT_DESC`。

顺带可修缺口 2（Irys `size`：GraphQL 补取 size 字段，或对账时保留上传当次的真值）。

### P2（条件项，非待办）加密可变索引

**触发条件**：仅当「跨设备 + 私密的资源管理」成为明确需求时才做——否则管理走 P0/P1
之上的**本地 override** 即可，不上链。若做，必须还三债：

1. **兜底**：保留标签查询做对账 + 发现老文件（还债 ①、向后兼容）。
2. **compaction**：链长超阈值（如 50 跳）写一份全量快照 `previousManifestTxId=null`
   截断遍历（还债 ②）。
3. **加密**：整份清单经 `@alixex/crypto` 加密再上链（还债 ③）。

管理字段（hidden/rename/folder/order）走清单的 `updated` / `deleted` 差量；多账户每
账户一条链、一次 head 查询，键空间按 owner 隔离。

---

## 8. 结论

**tag 就是索引；清单是管理工具，不是搜索加速。** 搜索已本地即时；「多文件同步慢」的
真实缺口（冷启动完整性）用 **P1 分页 + 水位** 几行补上，零上传成本、自动兼容。

**现在别做链上文件索引。** 做 **P0 修泄露 + P1 分页/水位**；管理需求真来了先用**本地
override** 顶上；只有「跨设备私密管理」成为明确需求时，再上加密清单（P2 条件项，配合
多账户设计）。

节奏：**P0 立即，P1 解决规模，P2 按需再定。**
