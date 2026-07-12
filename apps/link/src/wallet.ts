// Wallet connection — Arweave via an external wallet (Wander / ArConnect).
// Minimal by design: connect, read address + balance, disconnect. No key mgmt.

import { arweave } from "@alixex/arweave"

const PERMISSIONS = ["ACCESS_ADDRESS", "ACCESS_PUBLIC_KEY", "SIGN_TRANSACTION"]

interface ArweaveWalletApi {
  connect: (perms: string[], appInfo?: { name: string }) => Promise<void>
  disconnect: () => Promise<void>
  getActiveAddress: () => Promise<string>
}

function api(): ArweaveWalletApi | null {
  return (
    (globalThis as unknown as { arweaveWallet?: ArweaveWalletApi })
      .arweaveWallet ?? null
  )
}

export function hasArweaveWallet(): boolean {
  return api() !== null
}

export async function connectArweave(): Promise<string> {
  const w = api()
  if (!w) {
    throw new Error("未检测到 Arweave 钱包，请安装 Wander（原 ArConnect）扩展")
  }
  await w.connect(PERMISSIONS, { name: "ark" })
  return w.getActiveAddress()
}

export async function disconnectArweave(): Promise<void> {
  const w = api()
  if (w) await w.disconnect()
}

export async function getArBalance(address: string): Promise<string> {
  const winston = await arweave.wallets.getBalance(address)
  const ar = arweave.ar.winstonToAr(winston)
  return Number(ar).toFixed(4)
}

/**
 * The already-authorized EVM address (MetaMask), if any — used to look up Irys
 * upload history. Passive: uses `eth_accounts`, never prompts a connection.
 */
export async function getConnectedEvmAddress(): Promise<string | null> {
  const eth = (
    globalThis as unknown as {
      ethereum?: { request?: (a: { method: string }) => Promise<string[]> }
    }
  ).ethereum
  if (!eth?.request) return null
  try {
    const accounts = await eth.request({ method: "eth_accounts" })
    return accounts?.[0] ?? null
  } catch {
    return null
  }
}
