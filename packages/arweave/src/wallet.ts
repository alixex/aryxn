import Arweave from "arweave"
import { t } from "./i18n"

// Arweave client (mainnet gateway). Was `initArweave()` from @alixex/wallet-core;
// inlined so this package is self-contained (no multi-chain wallet dependency).
export const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
})

/**
 * 生成一个新的 Arweave 钱包
 */
export const generateArweaveWallet = async () => {
  const key = await arweave.wallets.generate()
  const address = await arweave.wallets.jwkToAddress(key)
  return { key, address }
}

/**
 * 估算 Arweave 交易费用
 */
export const estimateArweaveFee = async (dataSize: number) => {
  try {
    const priceInWinston = await arweave.transactions.getPrice(dataSize)
    const priceInAR = arweave.ar.winstonToAr(priceInWinston)

    return {
      winston: priceInWinston,
      ar: parseFloat(priceInAR),
      dataSize,
    }
  } catch (error) {
    console.error("Failed to estimate fee:", error)
    throw new Error(t("upload.fee_error"))
  }
}
