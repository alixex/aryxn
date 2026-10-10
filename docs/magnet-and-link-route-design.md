# 免费分享（磁力 / WebTorrent）+ 独立下载路由（`/link`）— 设计

- **Date**: 2026-07-14
- **Status**: 规划中（待评审 → 再拆实施计划）
- **Scope**: `apps/link` + `@alixex/crypto` 复用；不改 Arweave/Irys 现有数据契约
- **动机**：Arweave / Irys 都是**付费**上传。增加一个**免费**分享方案，接受它**不够稳定**，
  但在 UI 提前说清、并在 `/link` 路由报出**具体失败原因**。
- **决策**（本轮定案）：
  - 免费档用 **磁力 / WebTorrent**，**不做 IPFS**（理由见 §0，作为沉淀保留）。
  - 下载「验证码」= **分享密码（两通道 `p1`）**；防机器人交给 **Cloudflare 边缘验证码**，
    应用层不引入 CAPTCHA。
  - 下载密钥**始终留在 URL fragment（`#`）**，绝不进 query（`?`）——见 §6。

---

## 0. 决策沉淀：为什么免费档用磁力、不用 IPFS

> 本节保留 2026-07-14 的调研结论，作为「不选 IPFS」的依据，避免日后重复论证。

### 0.1 核心：浏览器 IPFS「是节点」≠「能被全网发现并被拉取」

「Helia 在浏览器里是一个 IPFS 节点」是**真的**——它有 peer ID、跑 js-libp2p、有 blockstore、
能拨出、能跑 bitswap、能按 CID 取并**本地校验**，也能把块喂给**已连上的** peer。但这和「上传后
陌生人随时能取」是两件事：

- **不能监听入站**：浏览器开不了监听 socket，别人**无法主动拨到它**（只能靠别人的 Circuit
  Relay 转发，且拨号方得先知道中继地址）。
- **不能当 DHT server / 宣告 provider 记录**：全网内容路由**压根不知道「这个浏览器有 CID X」**。
- 后果：陌生第三方或公共 HTTP 网关去「查 CID X 的 provider」**查不到、也拨不进**该浏览器节点。
  → **内容对不在同一套基础设施里连着它的人不可达。**

类比：浏览器 Helia ≈ **家里 NAT 后、没做端口转发、也没在 tracker 正确登记的 BT 客户端**——能下
能给已连 peer 上传（是完整节点），但**没人能主动连到它**（做不了对外发布的种子源）。官方近年也把
浏览器定位成 **verified-fetch / Service Worker Gateway 的「验证式检索」**，而非「浏览器当发布
节点」——侧面印证了这点。

### 0.2 连接性事实（「同 WiFi / 公网 IP 行不行」）

| 场景 | 结论 |
|------|------|
| 同 WiFi，两个**浏览器**之间 | ❌ 不自动。浏览器无 mDNS 互相发现不了；WebRTC 私对私握手仍需 **Relay + 信令**。有信令后数据走 LAN 直连，但无信令连不上 |
| 同 WiFi，浏览器 + 本地 **Kubo 节点** | ⚠️ 能但要手工配（Kubo 开浏览器可拨的 listener + 浏览器拿到 multiaddr） |
| **公网 IP 的设备** | ✅ 能成，**前提是它是节点（非浏览器）且开了 WebRTC-Direct listener**。若那台也只是浏览器，公网 IP 没用 |

> 一句话：只要出现一个「可被拨到的节点」（公网 IP + WebRTC-Direct，或一台中继）就能用，**但那是
> 服务器，不是浏览器**。两个纯浏览器之间永远至少需要一台信令/中继服务器。

### 0.3 桌面端也不改变「不选 IPFS」的结论

Mac 桌面 app **能**拆掉浏览器那堵墙（可跑真节点、能被拨入、能宣告、后台常驻做种），**但**：

- 它让 IPFS「作为真 P2P 节点正常工作」，**不让 IPFS 变永久**——可达性 = 至少一个 provider 在线；
  你的机器关机/离线且无人 pin → 仍取不到。永久性绕不开「有人一直在线存着」。
- 且做桌面端是**产品转向**（放弃「免安装、纯浏览器」，换来签名/公证/自动更新成本）——本轮不做。
- 附带红利：桌面端会让 **Iroh** 从观察项变强候选（原生 QUIC 直连 + 打洞 + iroh-blobs），留作
  §10 观察。

### 0.4 为什么磁力更贴合「免费临时分享」

「免费 + 持久」浏览器做不到（IPFS 要 pinning 服务、要账号/配额；见旧调研）。而本轮诉求是**免费、
可接受不稳定**——**磁力 / WebTorrent 正是为「浏览器间即时分享、临时、双方在线」而生**：免费公共
WSS tracker、浏览器直接做种、**无需任何账号**。它诚实地就是「临时」，和我们的免费定位对齐，比让
IPFS 硬凑「分享」简单可靠得多。

### 0.5 Sources（2026-07-14 查证）

- libp2p — [Browser Node Connectivity](https://libp2p.io/docs/browser-connectivity/) ·
  [WebRTC transport](https://docs.libp2p.io/concepts/transports/webrtc/)
- IPFS — [Verified Fetch](https://blog.ipfs.tech/verified-fetch/) ·
  [Shipyard 2024](https://ipshipyard.com/blog/2024-shipyard-improving-ipfs-on-the-web/)
- Iroh — [Iroh & the Web（浏览器 relay-only）](https://www.iroh.computer/blog/iroh-and-the-web)

---

## 1. 两档存储策略

| 档位 | 后端 | 免费？ | 持久性 | 能分享 | 需账号 |
|------|------|-------|--------|--------|--------|
| **永久档** | Arweave / Irys | ❌ 付费 | ✅ 永久 | ✅ 随时 | 钱包 |
| **免费临时档** | **磁力 / WebTorrent** | ✅ 全免费 | ❌ 做种者在线才在 | ⚠️ 双方在线时 | 无 |

免费档的不稳定面（做种者离线、双方需在线、WebRTC/tracker 可靠性）全部经 `/link` **精确报错**
（§6.3），并在上传/下载 UI **提前说清**。

---

## 2. 抽象层改造：`Chain` 扩一档 `magnet`，别改字段名

`Chain` 类型名与 `AssetRecord.chain` 字段**保留**（`chain` 已持久化进 IndexedDB，改名会孤立旧
记录 —— 硬约束）。只**扩联合**：

```ts
// storage.ts
export type Chain = "arweave" | "irys" | "magnet"
```

- 旧缓存只会是 `arweave` / `irys`，天然兼容。
- `AssetRecord.txId` 对磁力复用为 **infohash**（内容 id）。
- `AssetRecord.owner` 对磁力存 `"local"`（无钱包，§7）。
- `AssetRecord.url` 对磁力存 `magnet:?xt=urn:btih:<infohash>&tr=...`。

需按 `chain` 分支的既有点：

| 位置 | 改动 |
|------|------|
| `decryptAsset()` | 拉密文来源按 `chain` 分支：magnet → WebTorrent 取字节；其余 → 链网关 |
| `viewerLink()` | 产出新 `/link` 路由（§6），三种来源统一 |
| `home.ts` 分段控件 | 增「磁力」档；选中时**不要求账户**，走 WebTorrent seed |
| `accounts.ts` `ASSET_CHAIN` | 磁力无 owner 映射，不参与 owner 过滤（§7） |
| `router.ts` `parseViewerHash` | 正则纳入 `magnet`；新增 `/link` 解析 |
| `sync.ts` | 磁力无 GraphQL 索引 → 跳过 |

---

## 3. 磁力上传（WebTorrent seed）

**依赖**：`webtorrent`（~1MB+，**动态 `import()`**，仿 Irys，只在选磁力时加载）。

```ts
// 新文件 apps/link/src/webtorrent.ts —— 懒加载单例 client
let clientP: Promise<any> | null = null
async function getClient() {
  if (!clientP) clientP = import("webtorrent").then((m) => new m.default())
  return clientP
}

/** 把字节做种，resolve 出 magnet URI + infohash。上传者标签页需保持打开做种。 */
export async function seedBytes(bytes: Uint8Array, name: string): Promise<{ magnet: string; infohash: string }> {
  const client = await getClient()
  return new Promise((resolve) =>
    client.seed(new File([bytes], name), (torrent: any) =>
      resolve({ magnet: torrent.magnetURI, infohash: torrent.infoHash }),
    ),
  )
}
```

`storage.ts` 增 `uploadMagnet(file, opts)`：

```ts
export async function uploadMagnet(file: File, opts: UploadOpts = {}): Promise<AssetRecord> {
  let data = new Uint8Array(await file.arrayBuffer())
  let encKey: string | undefined
  if (opts.encrypt) {
    const enc = await encryptFile(file, opts.password)   // §5 复用，零改动
    data = enc.data
    encKey = enc.payload
  }
  opts.onProgress?.({ stage: "做种中…", progress: 60 })
  const { infohash } = await seedBytes(data, opts.encrypt ? "encrypted" : file.name)
  opts.onProgress?.({ stage: "完成（保持标签页打开以持续做种）", progress: 100 })
  return makeRecord("magnet", infohash, file, data.length, "local", encKey)
}
```

- **不要求钱包账户**：`chain()==="magnet"` 时 home 跳过「无账户 → 跳 /accounts」逻辑。
- **强临时性警告**（复用 `.enc-warning`）：上传成功页明确「**关闭标签页即停止做种；分享需对方在你
  在线时下载**」。
- **诚实的连通性上限**：浏览器 WebTorrent **只能连到同样走 WebRTC 的 peer**（其它 WebTorrent
  web 客户端 / 支持 WebRTC 的混合客户端 / web seed）——**普通 TCP/uTP 的传统 BT 客户端连不上**。
  实务上：这条磁力主要给「**用本 app 的 `/link` 页打开的人**」用。UI 不要暗示能用迅雷等传统客户端
  打开。

---

## 4. 磁力下载（WebTorrent add）

```ts
// webtorrent.ts
export async function fetchMagnetBytes(magnetOrInfohash: string): Promise<Uint8Array> {
  const client = await getClient()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("NOT_FOUND")), 30_000) // 无做种者 → 超时
    client.add(magnetOrInfohash, (torrent: any) => {
      torrent.files[0].arrayBuffer().then((b: ArrayBuffer) => {
        clearTimeout(timer)
        resolve(new Uint8Array(b))
      }, reject)
    })
  })
}
```

`decryptAsset()` 把「拉密文」按 `chain==="magnet"` 分支到 `fetchMagnetBytes`；明文磁力直取不解密。
超时/无 peer → 抛 `NOT_FOUND`，`/link` 提示「**需上传者在线做种**」（§6.3）。

---

## 5. 加密复用：`@alixex/crypto` / `encryptFile` 零改动

加密只认字节 + 一个 `payload` 字符串，**与后端无关**。磁力复用现有 `encryptFile`（先加密再 seed
**密文**）与 `decryptAsset` 的解密部分，只有「拉密文的来源」按 §4 分支。两通道 `p1` 密码模式对磁
力自动可用，无需 crypto 侧改动。

---

## 6. 下载路由重构：`/link` + fragment

### 6.1 安全红线：密钥进 fragment，绝不进 query

`/link?key=…` 有安全问题：**query（`?`）随每个请求发到服务器**（Cloudflare Pages、日志、
`Referer`、历史同步）——泄露解密密钥。**fragment（`#`）浏览器永不发给服务器**，这正是现有
`#/view/...` 的设计根据。

**结论**：`/link` 的**公开部分**（来源、txId/infohash）可放路径，**密钥/密码材料**必须留在 `#`。

### 6.2 路由形态

固定路径 `/link` + fragment 承载路由参数（单一静态 fallback，任何静态主机都成，密钥天然在 `#`）：

```
${origin}${base}link#/<source>/<id>/<payload>
  source  ∈ arweave | irys | magnet
  id      = txId | infohash（公开，非机密）
  payload = 密钥材料（可选；明文公开文件无此段）
            plain 加密 → base64(K)；两通道 → p1.<R>.<salt>
```

- **磁力 id 编码**：只放 infohash 太少（缺 tracker），实施时确定 `<id>` 承载「infohash + 默认
  tracker 列表」的编码（infohash + app 内置公共 WSS tracker 列表拼回 magnet），或整段 URL-encode
  magnet URI。
- **向后兼容**：旧 `#/view/<chain>/<txId>/<payload>` 链接**继续可用**——`parseViewerHash` 保留，
  映射到同一渲染函数。新分享统一发 `/link#...`。`viewerLink()` 改产 `/link#/...`。
- Cloudflare Pages 保证 `/link` 命中 SPA fallback（现有 fallback 已覆盖，验证 `link` 路径回退到
  `index.html`）。

### 6.3 下载页（新 `pages/link.ts`，抽自现 `viewer.ts`）

统一入口 `renderDownload(source, id, payload)`，覆盖三来源 × {明文 / plain 加密 / 两通道}。交互
沿用现 viewer，但**错误信息细化**（正是「报出具体原因」的诉求）：

| 情形 | 文案 key（en/zh） | 可重试 |
|------|------------------|-------|
| 需要密码（`p1` 未输入） | `link.needsPassword` | 输入后重试 |
| 密码错误 | `link.wrongPassword` | 是，保留输入 |
| 链接损坏（payload 格式错） | `link.malformed` | 否 |
| 找不到内容 / 已不在网络 | `link.notFound`（磁力：补「需上传者在线做种」） | 提示重试 |
| 网络错误 / tracker 不可达 | `link.network` | 是 |
| 低内存（Argon2id 分配失败） | `link.lowMemory` | 是 |
| 成功 | 文件名 + 图片预览 + 下载按钮（复用 `showDecrypted`） | —— |

- 现 `viewer.ts` 的密码输入 / 重入锁 / busy 态逻辑**整体迁移**到 `link.ts`，不重写。
- Cloudflare 边缘验证码在**页面加载前**拦机器人，应用层无需再做 CAPTCHA。

---

## 7. 历史 / 索引：磁力仅本地

- 磁力无 owner、无 GraphQL 索引 → `sync.ts` **跳过**。
- 上传记录写入 IndexedDB 缓存，`owner="local"`；home 的 owner 过滤放行：`|| r.chain === "magnet"`，
  使其**不依赖当前账户**始终可见。
- 明确告知：磁力历史**只在本机**，换设备不同步（且内容本身可能早已无人做种）。

---

## 8. 向后兼容 & 需同步修改的约束

- **AGENTS.md 硬约束需更新**：现有「No multi-chain beyond Arweave / Irys」改为允许**磁力（免费
  临时档）**，并写清其非永久、双方在线的定位。这是 owner 主动决策。
- **品牌叙事**：README「permanent file links」需区分「**永久档（Arweave/Irys）** + **免费临时档
  （磁力，非永久）**」，别让「permanent」覆盖到免费档。
- **不动的数据契约**：`App-Name: Aryxn` 链上 tag、`localStorage["aryxn:account"]`、
  `AssetRecord.chain` 字段名、旧 `#/view/...` 链接格式——全部保留。

---

## 9. 依赖与打包

- 新增运行时依赖：`webtorrent`。**动态 `import()`**，只在选磁力时加载，不进主包（仿 Irys）。
- 验证 `vite-plugin-node-polyfills` 覆盖 WebTorrent 所需（`Buffer` / stream 等）；量化对 build
  体积的影响。
- `pnpm run ci`（lint + type-check + build）须绿。

---

## 10. 未来观察项（本轮不做）

- **免费持久（IPFS + pinning）**：若「免费且随时可取」成真实需求，走 pinning 服务（Storacha
  BYO + UCAN，每人自带 5 GiB，不暴露长期密钥；或单 space + 硬配额）。见 §0 为何浏览器自做种做不到。
- **Iroh（n0）**：1.0（2026-06）Rust p2p，内容寻址（iroh-blobs）。浏览器里 relay-only + blobs
  浏览器版仍 WIP + 本质非持久，和磁力同桶——今天用 WebTorrent 更成熟。**桌面端**场景下再评估。
- **桌面端变体**：能跑真节点、后台常驻做种（§0.3），但不解决永久性且是产品转向。

---

## 11. 测试 / 验证

- **单测**（happy-dom，离线）：
  - `storage`: 磁力 `makeRecord` 形态；`decryptAsset` 对 `chain==="magnet"` 走 WebTorrent 取字
    节分支（mock `fetchMagnetBytes`）；明文直取路径。
  - `router`: `/link#/<source>/<id>/<payload>` 解析；旧 `#/view/...` 仍解析；`magnet` 进正则。
  - `link` 页错误映射：needsPassword / wrongPassword / malformed / notFound / network /
    lowMemory 各出对应文案。
  - WebTorrent 本身**不进单测**（重、需网络）——接口 mock。
- **手动 / e2e**（明暗 × 宽窄）：
  - 磁力：seed（明文 & 两通道）→ 复制 `/link#...` → **另一浏览器**打开取到 → 明文直下 / 密码档
    提示输入 → 正确密码解密、错误可重试。
  - 关掉做种标签页后再开链接 → 命中 `link.notFound`（「需上传者在线做种」）友好提示。
  - 旧 `#/view/...` 链接仍能打开。

---

## 12. 分期实施（拆 `docs/superpowers/plans/` 时展开）

- **P0 — 下载路由重构**（不依赖磁力，收益即时）：抽 `viewer.ts` → `pages/link.ts`，新增 `/link#...`
  路由 + 细化错误文案，保留旧 `#/view` 兼容，`viewerLink()` 改产 `/link`。
- **P1 — 磁力后端**：§2 抽象扩 `magnet` + `webtorrent.ts` + `uploadMagnet` / `fetchMagnetBytes`
  + home 增磁力档（免账户）+ §7 本地历史 + §3 强临时性警告 UI + locales + §8 约束/叙事更新。
- **P-later**：免费持久（IPFS+pinning）、Iroh、桌面端——按需再定（§10）。

---

## 13. 未决 / 风险

1. **磁力可靠性**：WebRTC/tracker 成功率、双方在线约束、只能连 WebRTC peer（传统 BT 客户端连不
   上）——靠 `/link` 精确报错 + 上传/下载 UI 提前说清来管理预期。
2. **公共 WSS tracker 稳定性**：需内置一组可用 tracker 列表并容错；tracker 全挂则 `link.network`。
3. **Bundle 体积**：webtorrent 传递依赖较大；动态加载缓解主包，需量化。
4. **移动端做种**：手机浏览器后台化即停止做种，磁力在移动端更不可靠——UI 需相应提示。
