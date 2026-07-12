// EIP-6963 multi-injected-provider discovery for the EVM (Irys) side.
// Vanilla, zero-dependency: lists every injected EVM wallet (MetaMask, Rabby,
// Coinbase, OKX…) instead of hardcoding `window.ethereum`. No React / connect-kit.

export interface EvmWalletInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export interface EvmWallet {
  info: EvmWalletInfo
  provider: unknown // EIP-1193 provider
}

/**
 * Ask injected wallets to announce themselves (EIP-6963) and collect the
 * responses over a short window. Falls back to the legacy single
 * `window.ethereum` if no wallet speaks EIP-6963.
 */
export function discoverEvmWallets(timeoutMs = 300): Promise<EvmWallet[]> {
  return new Promise((resolve) => {
    const found = new Map<string, EvmWallet>()

    const onAnnounce = (e: Event) => {
      const detail = (e as CustomEvent).detail as EvmWallet | undefined
      if (detail?.info?.uuid && detail.provider) {
        found.set(detail.info.uuid, detail)
      }
    }

    window.addEventListener(
      "eip6963:announceProvider",
      onAnnounce as EventListener,
    )
    window.dispatchEvent(new Event("eip6963:requestProvider"))

    window.setTimeout(() => {
      window.removeEventListener(
        "eip6963:announceProvider",
        onAnnounce as EventListener,
      )
      const list = [...found.values()]
      if (list.length === 0) {
        const legacy = (globalThis as { ethereum?: unknown }).ethereum
        if (legacy) {
          list.push({
            info: {
              uuid: "legacy",
              name: "浏览器 EVM 钱包",
              icon: "",
              rdns: "legacy",
            },
            provider: legacy,
          })
        }
      }
      resolve(list)
    }, timeoutMs)
  })
}
