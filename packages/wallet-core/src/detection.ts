import { ethers } from "ethers"
import * as solana from "@solana/web3.js"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import Arweave from "arweave"
import { Chains } from "@aryxn/chain-constants"
import type { WalletKey, WalletRecord } from "./types"
import { defaultArweave } from "./arweave-init"
import {
  validateMnemonic,
  toBase58,
  fromBase58,
  getBitcoinAddressFromWIF,
} from "@aryxn/crypto"

export async function detectChainAndAddress(
  input: WalletKey | string,
  arweaveInstance: Arweave = defaultArweave,
): Promise<{
  chain: WalletRecord["chain"]
  address: string
  key: string
  mnemonic?: string
}> {
  if (typeof input === "object" && input.kty === "RSA") {
    const address = await arweaveInstance.wallets.jwkToAddress(input)
    return {
      chain: Chains.ARWEAVE,
      address,
      key: JSON.stringify(input),
    }
  }

  const str = String(input).trim()

  if (validateMnemonic(str)) {
    const wallet = ethers.Wallet.fromPhrase(str)
    return {
      chain: Chains.ETHEREUM,
      address: wallet.address,
      key: wallet.privateKey,
      mnemonic: str,
    }
  }

  if (/^(0x)?[0-9a-fA-F]{64}$/.test(str)) {
    const wallet = new ethers.Wallet(str.startsWith("0x") ? str : "0x" + str)
    return { chain: Chains.ETHEREUM, address: wallet.address, key: str }
  }

  if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(str)) {
    try {
      const decoded = fromBase58(str)
      const keypair = solana.Keypair.fromSecretKey(decoded)
      return {
        chain: Chains.SOLANA,
        address: keypair.publicKey.toBase58(),
        key: str,
      }
    } catch {
      /* ignore */
    }
  }

  if (str.startsWith("suiprivkey")) {
    try {
      const keypair = Ed25519Keypair.fromSecretKey(str)
      return {
        chain: Chains.SUI,
        address: keypair.getPublicKey().toSuiAddress(),
        key: str,
      }
    } catch {
      /* ignore */
    }
  }

  // Bitcoin WIF detection
  const btcAddress = getBitcoinAddressFromWIF(str)
  if (btcAddress) {
    return {
      chain: Chains.BITCOIN,
      address: btcAddress,
      key: str,
    }
  }

  try {
    const parsed = JSON.parse(str)
    if (parsed.kty === "RSA") {
      const address = await arweaveInstance.wallets.jwkToAddress(parsed)
      return { chain: Chains.ARWEAVE, address, key: str }
    }
    if (Array.isArray(parsed) && parsed.length === 64) {
      const keyBytes = new Uint8Array(parsed)
      const keypair = solana.Keypair.fromSecretKey(keyBytes)
      return {
        chain: Chains.SOLANA,
        address: keypair.publicKey.toBase58(),
        key: toBase58(keyBytes),
      }
    }
  } catch {
    /* ignore */
  }

  throw new Error("Unsupported or invalid key format")
}
