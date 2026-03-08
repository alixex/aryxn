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
  hintChain?: string,
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

  // Mnemonic detection
  if (validateMnemonic(str)) {
    const wallet = ethers.Wallet.fromPhrase(str)
    return {
      chain: (hintChain as any) || Chains.ETHEREUM,
      address: wallet.address,
      key: wallet.privateKey,
      mnemonic: str,
    }
  }

  // EVM Private Key detection
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(str)) {
    const wallet = new ethers.Wallet(str.startsWith("0x") ? str : "0x" + str)
    return {
      chain: (hintChain as any) || Chains.ETHEREUM,
      address: wallet.address,
      key: str,
    }
  }

  // Solana Keypair detection
  if (/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(str)) {
    try {
      const decoded = fromBase58(str)
      const keypair = solana.Keypair.fromSeed(decoded.slice(0, 32))
      return {
        chain: Chains.SOLANA,
        address: keypair.publicKey.toBase58(),
        key: str,
      }
    } catch {
      /* ignore */
    }
  }

  // Sui Private Key detection
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
    if (
      Array.isArray(parsed) &&
      (parsed.length === 64 || parsed.length === 32)
    ) {
      const keypair = solana.Keypair.fromSeed(
        new Uint8Array(parsed.slice(0, 32)),
      )
      return {
        chain: Chains.SOLANA,
        address: keypair.publicKey.toBase58(),
        key: toBase58(new Uint8Array(parsed)),
      }
    }
  } catch {
    /* ignore */
  }

  throw new Error("Unsupported or invalid key format")
}
