import { useEffect } from "react"
import { useWallet } from "@/hooks/account-hooks"
import { Chains } from "@aryxn/chain-constants"

/**
 * A global provider to silently sync Arweave records in the background.
 * Moved from Dashboard to here to prevent duplicate firing on page navigations.
 */
export function AutoSyncProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet()
  const walletManager = wallet.internal
  const externalWallets = wallet.external

  useEffect(() => {
    // Determine target Arweave addresses
    const internalArweaveAddresses = walletManager.wallets
      .filter((w) => w.chain === Chains.ARWEAVE)
      .map((w) => w.address)

    const candidates = [...internalArweaveAddresses]
    if (externalWallets.arAddress) {
      candidates.push(externalWallets.arAddress)
    }

    const addresses = Array.from(new Set(candidates.filter(Boolean)))

    if (addresses.length === 0) {
      return
    }

    // Schedule syncs for all collected accounts
    const schedulePromises = addresses.map(async (address) => {
      try {
        const { scheduleAutoSync } = await import("@/lib/file/file-sync-direct")
        scheduleAutoSync(address, () => {
          // Log completion (UI refreshes handle this locally if they are active)
          console.debug(
            `[AutoSync] Background file sync complete for: ${address}`,
          )
        })
      } catch (error) {
        console.warn(
          `[AutoSync] Failed to schedule auto sync for ${address}:`,
          error,
        )
      }
    })

    Promise.all(schedulePromises).catch((error) => {
      console.warn("[AutoSync] Failed to schedule background auto sync:", error)
    })
  }, [walletManager.wallets, externalWallets.arAddress])

  return <>{children}</>
}
