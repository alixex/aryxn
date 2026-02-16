import { BIP32Factory } from "bip32"
import * as ecc from "tiny-secp256k1"
import { derivePath } from "ed25519-hd-key"
import bs58 from "bs58"

import * as bitcoin from "bitcoinjs-lib"
import ECPairFactory from "ecpair"

// Initialize Bitcoin ecc
bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)
const bip32 = BIP32Factory(ecc)

/**
 * Derive an Ed25519 keypair from a seed for a specific path (Solana, Sui, etc.)
 */
export const deriveEd25519Key = (seed: Uint8Array, path: string) => {
  const derived = derivePath(path, Buffer.from(seed).toString("hex"))
  return {
    key: derived.key,
    chainCode: derived.chainCode,
  }
}

/**
 * Derive a Bitcoin Taproot account from a seed
 */
export const deriveBitcoinAccount = (seed: Uint8Array, path: string) => {
  const root = bip32.fromSeed(Buffer.from(seed))
  const child = root.derivePath(path)

  if (!child.privateKey) {
    throw new Error("Failed to derive private key")
  }

  const { address } = bitcoin.payments.p2tr({
    internalPubkey: Buffer.from(child.publicKey.slice(1, 33)),
  })

  // Convert private key to WIF
  const wif = ECPair.fromPrivateKey(child.privateKey).toWIF()

  return {
    address: address || "unknown",
    wif,
    privateKey: child.privateKey,
    publicKey: child.publicKey,
  }
}

/**
 * Validate a Bitcoin WIF key and return its address (Taproot)
 */
export const getBitcoinAddressFromWIF = (wif: string) => {
  try {
    const keyPair = ECPair.fromWIF(wif)
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(keyPair.publicKey.slice(1, 33)),
    })
    return address || null
  } catch {
    return null
  }
}

/**
 * Derive a secp256k1 keypair from a seed for a specific path (Ethereum, etc.)
 */
export const deriveSecp256k1Key = (seed: Uint8Array, path: string) => {
  const root = bip32.fromSeed(Buffer.from(seed))
  const child = root.derivePath(path)

  if (!child.privateKey) {
    throw new Error("Failed to derive private key")
  }

  return {
    privateKey: child.privateKey,
    publicKey: child.publicKey,
  }
}

/**
 * Convert a buffer to a Base58 string
 */
export const toBase58 = (buffer: Uint8Array): string => {
  return bs58.encode(buffer)
}

/**
 * Convert a Base58 string to a buffer
 */
export const fromBase58 = (str: string): Uint8Array => {
  return bs58.decode(str)
}
