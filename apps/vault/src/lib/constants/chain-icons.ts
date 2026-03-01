import { CHAIN_ICONS as LOCAL_ICONS } from "@aryxn/chain-constants"

export const CHAIN_ICONS: Record<string, string> = LOCAL_ICONS

export type ChainIconType = keyof typeof CHAIN_ICONS
