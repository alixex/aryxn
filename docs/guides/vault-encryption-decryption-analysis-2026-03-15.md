# Vault 加密/解密逻辑复盘与验证（2026-03-15）

## 目标与范围

本次分析目标：

1. 重新梳理 Vault 当前上传加密与下载/路由解密链路。
2. 验证当前实现是否已经避免错误 key 来源。
3. 明确现状风险与后续建议。

范围说明：

1. 历史异常数据不作为本次修复目标。
2. 重点验证当前代码路径和新数据行为。

---

## 一、加密链路分析（Upload）

### 1. Key 来源与生成

1. 用户在 Vault 解锁后，通过 PBKDF2 派生 32 字节主密钥。
2. 主密钥保存在运行态上下文（wallet.internal.masterKey）。
3. 加密上传时，上传层使用 wallet.internal.masterKey 作为 encryptionKey。

关键实现：

1. apps/vault/src/hooks/upload-hooks/use-upload-handler.ts
2. packages/crypto/src/index.ts (deriveKey)

### 2. 上传时数据处理顺序

1. 可选压缩（gzip）。
2. 可选加密（XChaCha20-Poly1305，libsodium secretbox）。
3. 将 nonce 写入 Encryption-Params 标签（JSON 字符串）。
4. 写入 Encryption-Algo 标签。

关键实现：

1. packages/arweave/src/upload.ts

### 3. 当前结论

1. 上传端已不再使用固定全零 key。
2. 加密上传在 masterKey 不可用时会阻断并提示。

---

## 二、解密链路分析（Download / Resource Route）

### A. 历史下载面板链路（history-table）

处理流程：

1. 读取交易 metadata 与 tags。
2. 解码 tags 后提取加密参数和压缩参数。
3. 进入 processFileData：
   - 先解密（如果是加密文件且请求解密）
   - 再解压

nonce 选择策略：

1. 优先 transaction tag 中的 Encryption-Params。
2. tags 不可用或解析失败时回退数据库 encryptionParams。

关键实现：

1. apps/vault/src/components/history-table/download-handler.ts
2. apps/vault/src/components/history-table/process-data.ts

### B. 资源路由链路（/:ownerAddress/:txId）

处理流程：

1. 用户输入密码。
2. 由密码 + systemSalt 派生 key。
3. 用 vaultId 校验密码是否正确。
4. 读取本地缓存密文（无则链上下载并写回缓存）。
5. 解密尝试矩阵：
   - 本地 metadata + 主 key
   - 本地 metadata + 历史兼容 zero key
   - 链上 metadata + 主 key（按需回源）
   - 链上 metadata + 历史兼容 zero key（按需回源）

关键实现：

1. apps/vault/src/routes/resource-by-owner-tx.tsx

---

## 三、解密细节校验点

### 1. nonce 规范化

当前已做：

1. 去除空白字符。
2. 兼容 base64url（-/\_ 转 +/）。
3. 自动补齐 padding。
4. 解码后强校验 nonce 必须为 24 字节。

关键实现：

1. apps/vault/src/components/history-table/process-data.ts

### 2. 算法一致性

1. 加密：crypto_secretbox_easy（XChaCha20-Poly1305）。
2. 解密：crypto_secretbox_open_easy。
3. key 长度：32 字节。
4. nonce 长度：24 字节。

关键实现：

1. packages/crypto/src/index.ts

---

## 四、本次验证结果

### 1. 静态验证

1. 已检查上传处理文件，不再存在 new Uint8Array(32) 作为上传加密 key 的调用。
2. 加密上传代码路径已绑定 wallet.internal.masterKey。

### 2. 编译验证

执行命令：

pnpm -C apps/vault type-check

结果：

1. tsc -b --noEmit 通过。

---

## 五、结论

1. 当前新数据链路已经统一到主密钥体系：上传和解密逻辑在设计上是一致的。
2. nonce 处理已具备鲁棒性（规范化 + 长度硬校验）。
3. 资源路由具备按需回源与多组合解密尝试，排错能力比之前更强。

---

## 六、建议（面向后续）

1. 增加自动化测试：
   - 上传加密 key 来源必须为 masterKey。
   - nonce 规范化与 24 字节校验。
   - 资源路由解密尝试矩阵（本地/链上 metadata + 主/兼容 key）。
2. 为资源路由增加受控的 debug 开关日志（仅开发环境），记录每个尝试分支结果，便于定位个别 tx 的不可恢复问题。
3. 在历史兼容窗口结束后，可评估移除 zero key 兼容分支，进一步收敛安全面。
