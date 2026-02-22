import { CHAIN_ICONS } from "@/lib/constants/chain-icons"
import { cn } from "@/lib/utils"

interface ChainIconProps {
  chain?: string
  className?: string
  size?: "xs" | "sm" | "md" | "lg"
}

export function ChainIcon({ chain, className, size = "md" }: ChainIconProps) {
  if (!chain) return null

  const chainKey = chain.toLowerCase()
  let iconUrl = CHAIN_ICONS[chainKey]

  // Fallback mappings if the chain name is slightly different
  if (!iconUrl) {
    if (chainKey.includes("eth")) iconUrl = CHAIN_ICONS.ethereum
    else if (chainKey.includes("base")) iconUrl = CHAIN_ICONS.base
    else if (chainKey.includes("arb")) iconUrl = CHAIN_ICONS.arbitrum
    else if (chainKey.includes("op") || chainKey.includes("opt"))
      iconUrl = CHAIN_ICONS.optimism
    else if (chainKey.includes("sol")) iconUrl = CHAIN_ICONS.solana
    else if (chainKey.includes("poly") || chainKey.includes("matic"))
      iconUrl = CHAIN_ICONS.polygon
    else if (chainKey.includes("arw") || chainKey.includes("irys"))
      iconUrl = CHAIN_ICONS.arweave
  }

  if (!iconUrl) {
    return (
      <div
        className={cn(
          "bg-secondary flex items-center justify-center rounded-full text-[10px] font-bold",
          size === "xs" && "h-4 w-4",
          size === "sm" && "h-5 w-5",
          size === "md" && "h-8 w-8",
          size === "lg" && "h-12 w-12",
          className,
        )}
      >
        {chain.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative flex-shrink-0",
        size === "xs" && "h-4 w-4",
        size === "sm" && "h-5 w-5",
        size === "md" && "h-8 w-8",
        size === "lg" && "h-12 w-12",
        className,
      )}
    >
      <img
        src={iconUrl}
        alt={chain}
        className="h-full w-full rounded-full object-contain"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = "none"
        }}
      />
    </div>
  )
}
