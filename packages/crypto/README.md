# @aryxn/crypto

The central cryptographic library for the Aryxn project. This package provides pure, low-level cryptographic primitives and key derivation logic for multiple blockchains.

## Features

- **Key Derivation**: Supports BIP32, BIP39, Ed25519 (Solana/Sui), and Secp256k1 (Ethereum/Bitcoin).
- **Encryption**: Authenticated encryption using `libsodium-wrappers` (XChaCha20-Poly1305).
- **Utilities**: Base58/Base64 encoding/decoding, mnemonic generation, and validation.

## API Reference

| Function                           | Description                                               |
| :--------------------------------- | :-------------------------------------------------------- |
| `generateMnemonic(strength?)`      | Generates a new BIP39 mnemonic phrase (default 12 words). |
| `validateMnemonic(mnemonic)`       | Validates a BIP39 mnemonic phrase.                        |
| `deriveEd25519Key(seed, path)`     | Derives a keypair for Ed25519 chains (Solana, Sui).       |
| `deriveBitcoinAccount(seed, path)` | Derives a Bitcoin Taproot account (address & WIF).        |
| `deriveSecp256k1Key(seed, path)`   | Derives a keypair for ECDSA chains (Ethereum).            |
| `encryptData(data, key)`           | Encrypts data using XChaCha20-Poly1305.                   |
| `decryptData(cipher, nonce, key)`  | Decrypts data using XChaCha20-Poly1305.                   |
| `generateSalt(length?)`            | Generates a cryptographically strong random salt.         |

## Usage

```typescript
import { generateMnemonic, deriveSolanaKey, encryptData } from "@aryxn/crypto"

// Generate a mnemonic
const mnemonic = generateMnemonic()

// Derive a keys
const solanaKey = deriveEd25519Key(seed, "m/44'/501'/0'/0'")
const bitcoinAccount = deriveBitcoinAccount(seed, "m/86'/0'/0'/0/0")

// Encrypt data
const { ciphertext, nonce } = await encryptData(data, key)
```
