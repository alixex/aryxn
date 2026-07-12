# Aryxn

<p align="center">
   <img src="https://aryxn.com/icon.jpg" alt="Aryxn Icon" width="200" />
</p>

[English](./README.md) | [中文]

---

## 产品简介

**Aryxn** 是一个极简、开源的 **永久文件链接** Web 应用。上传一个文件，即可获得一条与网络同寿的链接——
存储在 **Arweave** 或 **Irys** 上，并可选择**客户端加密**，使得只有持有链接的人才能打开。

一切都在浏览器中运行：密钥与密码永不离开设备，链上数据始终是唯一事实来源，应用仅保留少量本地缓存以提升速度。

**🌐 在线地址**：https://aryxn.com/

---

## 功能特性

### 🔗 永久链接

- 在同一界面上传到 **Arweave**（用 Arweave 账户付费）或 **Irys**（用 EVM 钱包付费）
- 每次上传都写入相同的 `App-Name: Aryxn` 标签契约，链接在各版本间始终可检索
- 实时上传进度，完成后得到一条可分享的永久 URL

### 🔒 客户端加密

- 可选的逐文件加密，使用 **XChaCha20-Poly1305**（libsodium `crypto_secretbox`）
- 解密密钥保存在 **URL 片段**（`#…`）中——永不发送到任何服务器，只有持有完整链接的人才能解密
- 内置查看器路由（`#/view/<chain>/<txId>/<key>`）拉取密文并在浏览器内解密

### 🔑 账户

- **本地账户**：在浏览器内生成或导入 Arweave keyfile，以**加密**形式（PBKDF2 由密码派生密钥）存于
  `localStorage`——无需任何扩展
- **外部钱包**：连接 **Wander**（原 ArConnect）为 Arweave 上传签名
- **EVM 钱包**：通过 **EIP-6963** 发现（MetaMask 等），用于为 Irys 上传付费
- 可将 keyfile 导出为明文或加密 JSON，用于备份 / 迁移

### 🗂️ 历史与搜索

- 你的链接缓存在本地（IndexedDB），并从两条网络的网关对账
- 对自己的文件进行即时的客户端搜索
- 双语界面（English / 中文）与 系统 / 浅色 / 深色 主题

---

## 工作原理

1. **拖入文件** → 选择网络（Arweave 或 Irys），并可选开启加密。
2. **付费并上传** → 文件（加密或未加密）被发布到链上，进度实时展示。
3. **获得永久链接** → 复制、分享。加密链接会把密钥带在片段中。
4. **随后查找** → 仪表板会列出并搜索你上传过的一切。

---

## 快速开始

需要 **Node ≥ 20** 与 **pnpm ≥ 10**。

```bash
pnpm install          # 安装 workspace 依赖
pnpm dev              # 运行应用（apps/link），访问 http://localhost:5173
pnpm build            # 生产构建 → apps/link/dist
pnpm preview          # 预览生产构建
```

质量校验：

```bash
pnpm lint             # 对 apps + packages 运行 oxlint
pnpm type-check       # 对 apps + packages 运行 tsc --noEmit
pnpm ci               # lint + type-check + build
```

部署（Cloudflare Pages）：

```bash
pnpm deploy:cloudflare
```

---

## 技术栈

- **UI**：无框架 SPA，基于 [**ranui**](https://www.npmjs.com/package/ranui) 构建——一套 Web Components
  + 细粒度响应式 builder，实现了 **Geist**（Vercel）设计系统
- **语言 / 工具链**：TypeScript、Vite、pnpm workspaces
- **存储**：Arweave（永久）+ Irys（永久，EVM 付费）；IndexedDB + localStorage 作本地缓存
- **付费**：`ethers` v6 与 `@irys/web-upload` 用于 Irys
- **加密**：libsodium XChaCha20-Poly1305 加密文件；PBKDF2（WebCrypto）由密码派生存储密钥

---

## Monorepo 架构

### apps/

- **link/**（`@alixex/link`）：Web 应用——上传流程、加密、账户、历史与搜索

另见：[apps/README.md](apps/README.md)

### packages/

- **arweave/**（`@alixex/arweave`）：Arweave 上传、费用估算、（解）压缩，以及 GraphQL 搜索 + 缓存
- **crypto/**（`@alixex/crypto`）：对称加密（libsodium）与编码 / PBKDF2 辅助
- **storage/**（`@alixex/storage`）：加密的 `localStorage` 缓存 + IndexedDB 键值辅助
- **changelogs/**：包级变更说明资产

### 仓库结构（概览）

```
aryxn/
├── apps/
│   └── link/             # 永久链接 Web 应用（@alixex/link）
├── packages/
│   ├── arweave/          # Arweave 上传 / 费用 / 压缩 / 搜索
│   ├── crypto/           # 加密 + 编码辅助
│   ├── storage/          # 本地缓存（localStorage + IndexedDB）
│   └── changelogs/       # 变更说明资产
├── docs/                 # 笔记与规划文档
└── scripts/              # 自动化与初始化脚本
```

## 开源

Aryxn 开源，采用 **AGPL-3.0** 许可。
详见 [LICENSE](./LICENSE)。

**欢迎贡献** —— 见 [GitHub 仓库](https://github.com/ranuts/aryxn)。

---

**Aryxn —— 一条比一切都长寿的链接。**
