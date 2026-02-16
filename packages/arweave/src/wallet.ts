import { initArweave } from "@aryxn/wallet-core"

// Initialize Arweave
export const arweave = initArweave()

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
    throw new Error("无法获取费用信息，请稍后重试或检查网络连接")
  }
}
