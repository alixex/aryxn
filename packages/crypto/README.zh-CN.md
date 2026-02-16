# @aryxn/crypto

Aryxn 项目的核心加密库。该包提供纯净的底层加密原语和针对多条区块链的密钥派生逻辑。

## 功能特性

- **密钥派生**: 支持 BIP32, BIP39, Ed25519 (Solana/Sui), 和 Secp256k1 (Ethereum/Bitcoin) 标准。
- **加密**: 使用 `libsodium-wrappers` (XChaCha20-Poly1305) 进行经过身份验证的加密。
- **工具类**: 提供 Base58/Base64 编码解码、助记词生成与验证功能。

## API 参考

| 函数                               | 说明                                            |
| :--------------------------------- | :---------------------------------------------- |
| `generateMnemonic(strength?)`      | 生成新的 BIP39 助记词 (默认 12 个单词)。        |
| `validateMnemonic(mnemonic)`       | 验证 BIP39 助记词是否有效。                     |
| `deriveEd25519Key(seed, path)`     | 为 Ed25519 链 (Solana, Sui) 派生密钥对。        |
| `deriveBitcoinAccount(seed, path)` | 派生比特币 Taproot 账户信息 (地址与 WIF 私钥)。 |
| `deriveSecp256k1Key(seed, path)`   | 为 ECDSA 链 (Ethereum) 派生密钥对。             |
| `encryptData(data, key)`           | 使用 XChaCha20-Poly1305 算法加密数据。          |
| `decryptData(cipher, nonce, key)`  | 解密 XChaCha20-Poly1305 加密的数据。            |
| `generateSalt(length?)`            | 生成加密安全的随机盐。                          |

## 使用示例

```typescript
import {
  generateMnemonic,
  deriveSolanaKey,
  encryptData,
} from "@aryxn/crypto"

// 生成助记词
const mnemonic = generateMnemonic()

// 派生密钥
const solanaKey = deriveEd25519Key(seed, "m/44'/501'/0'/0'")
const bitcoinAccount = deriveBitcoinAccount(seed, "m/86'/0'/0'/0/0")

// 加密数据
const { ciphertext, nonce } = await encryptData(data, key)
```
