import { RPCs } from "@alixex/chain-constants"

const IRYS_GATEWAY = "https://gateway.irys.xyz"
const ARWEAVE_DOWNLOAD_GATEWAYS = [
  RPCs.ARWEAVE_BASE,
  "https://ar-io.net",
] as const

export function getDownloadGateways(storageType: string): readonly string[] {
  if (storageType === "irys") {
    return [IRYS_GATEWAY]
  }
  return ARWEAVE_DOWNLOAD_GATEWAYS
}

export function getPrimaryGatewayUrl(
  storageType: string,
  txId: string,
): string {
  return `${getDownloadGateways(storageType)[0]}/${txId}`
}
