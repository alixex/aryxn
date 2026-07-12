import { signal } from "ranui/builder"
import { getArBalance } from "./wallet"
import type { AssetRecord } from "./storage"
import type { AccountRecord } from "./accounts"

export interface Usage {
  count: number
  totalBytes: number
}

/** Pure reduction over an account's owner-filtered records. */
export function usageFor(records: AssetRecord[]): Usage {
  return records.reduce<Usage>(
    (u, r) => ({ count: u.count + 1, totalBytes: u.totalBytes + (r.size || 0) }),
    { count: 0, totalBytes: 0 },
  )
}

// address → "1.2345 AR" | "0.05 ETH" | null (loading/failed). Reactive.
const [balances, setBalances] = signal<Record<string, string | null>>({})
export { balances }

/** Best-effort: fetch and cache the native balance for an account. Silent on failure. */
export async function refreshBalance(acc: AccountRecord): Promise<void> {
  if (!acc.address) return
  try {
    if (acc.network === "arweave") {
      const ar = await getArBalance(acc.address)
      setBalances({ ...balances(), [acc.address]: `${ar} AR` })
    } else {
      const eth = (globalThis as unknown as {
        ethereum?: { request?: (a: { method: string; params: unknown[] }) => Promise<string> }
      }).ethereum
      if (!eth?.request) return
      const hex = await eth.request({ method: "eth_getBalance", params: [acc.address, "latest"] })
      const wei = BigInt(hex)
      const eth4 = (Number(wei) / 1e18).toFixed(4)
      setBalances({ ...balances(), [acc.address]: `${eth4} ETH` })
    }
  } catch {
    /* best-effort — leave undefined */
  }
}
