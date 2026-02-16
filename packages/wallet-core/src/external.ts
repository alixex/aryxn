import { db } from "@aryxn/storage"

export interface ExternalWalletsRaw {
  isPaymentConnected?: boolean
  allEVMAddresses?: string[] | null
  paymentAddress?: string | null
  isArConnected?: boolean
  arAddress?: string | null
  isSolConnected?: boolean
  solAddress?: string | null
  isSuiConnected?: boolean
  suiAddress?: string | null
}

export interface NormalizedExternalAccount {
  id: string
  chain: string
  address: string
  provider?: string
  isExternal: true
}

/**
 * Normalize external wallet connections into a simple account list.
 * This centralizes origin parsing so UI can focus on presentation.
 */
export function normalizeExternalAccounts(
  raw: ExternalWalletsRaw,
): NormalizedExternalAccount[] {
  const out: NormalizedExternalAccount[] = []

  if (
    raw.isPaymentConnected &&
    raw.allEVMAddresses &&
    Array.isArray(raw.allEVMAddresses)
  ) {
    for (const addr of raw.allEVMAddresses) {
      if (!addr) continue
      out.push({
        id: `external-evm-${addr}`,
        chain: "ethereum",
        address: addr,
        provider: "EVM",
        isExternal: true,
      })
    }
  }

  if (raw.isArConnected && raw.arAddress) {
    out.push({
      id: `external-arweave-${raw.arAddress}`,
      chain: "arweave",
      address: raw.arAddress,
      provider: "ArConnect",
      isExternal: true,
    })
  }

  if (raw.isSolConnected && raw.solAddress) {
    out.push({
      id: `external-solana-${raw.solAddress}`,
      chain: "solana",
      address: raw.solAddress,
      provider: "Phantom",
      isExternal: true,
    })
  }

  if (raw.isSuiConnected && raw.suiAddress) {
    out.push({
      id: `external-sui-${raw.suiAddress}`,
      chain: "sui",
      address: raw.suiAddress,
      provider: "Sui Wallet",
      isExternal: true,
    })
  }

  return out
}

/**
 * Clear persisted external account selection state for a vault.
 * Encapsulates DB access so callers don't need to import `db`.
 */
export async function clearExternalAccountState(
  vaultId?: string,
): Promise<void> {
  if (!vaultId) return
  try {
    await db.run("DELETE FROM vault_metadata WHERE key = ?", [
      `use_external_${vaultId}`,
    ])
  } catch (e) {
    console.warn("Failed to clear external account state:", e)
  }
}
