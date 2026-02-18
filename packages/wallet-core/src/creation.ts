import { ethers } from "ethers"
import * as solana from "@solana/web3.js"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import Arweave from "arweave"
import { WalletRecord } from "./types"
import { defaultArweave } from "./arweave-init"
import {
  generateMnemonic,
  mnemonicToSeed,
  deriveEd25519Key,
  deriveBitcoinAccount,
  toBase58,
} from "@aryxn/crypto"

export async function createWallet(
  chain: WalletRecord["chain"],
  arweaveInstance: Arweave = defaultArweave,
) {
  let key: string
  let address: string
  let mnemonic: string | undefined

  if (chain === "arweave") {
    const jwk = await arweaveInstance.wallets.generate()
    key = JSON.stringify(jwk)
    address = await arweaveInstance.wallets.jwkToAddress(jwk)
  } else {
    const phrase = generateMnemonic()
    mnemonic = phrase
    const seed = await mnemonicToSeed(phrase)

    if (chain === "ethereum") {
      const wallet = ethers.Wallet.fromPhrase(phrase)
      key = wallet.privateKey
      address = wallet.address
    } else if (chain === "solana") {
      const derived = deriveEd25519Key(seed, "m/44'/501'/0'/0'")
      const keypair = solana.Keypair.fromSeed(derived.key)
      key = toBase58(keypair.secretKey)
      address = keypair.publicKey.toBase58()
    } else if (chain === "sui") {
      const keypair = Ed25519Keypair.deriveKeypair(phrase)
      key = keypair.getSecretKey()
      address = keypair.getPublicKey().toSuiAddress()
    } else if (chain === "bitcoin") {
      const account = deriveBitcoinAccount(seed, "m/86'/0'/0'/0/0")
      key = account.wif
      address = account.address
    } else {
      throw new Error("Unsupported chain for creation")
    }
  }

  return { key, address, mnemonic }
}
