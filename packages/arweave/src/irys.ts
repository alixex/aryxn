import { WebIrys } from "@irys/sdk"
import { RPCs, type ChainType } from "@aryxn/chain-constants"

export type IrysChain = ChainType

export interface IrysConfig {
  url?: string
  token: string
  rpcUrl?: string
  wallet: any
}

/**
 * Service to handle Irys (formerly Bundlr) operations for multi-chain payments and storage.
 */
export class IrysService {
  private irysInstances: Map<string, WebIrys> = new Map()

  /**
   * Get or initialize a WebIrys instance for a specific token/chain.
   */
  async getIrysInstance(config: IrysConfig): Promise<WebIrys> {
    const key = `${config.token}-${config.rpcUrl || "default"}`
    if (this.irysInstances.has(key)) {
      return this.irysInstances.get(key)!
    }

    const irys = new WebIrys({
      url: config.url || RPCs.IRYS_NODE,
      token: config.token,
      wallet: config.wallet,
      config: config.rpcUrl ? { providerUrl: config.rpcUrl } : undefined,
    })

    await irys.ready()
    this.irysInstances.set(key, irys)
    return irys
  }

  /**
   * Get the price in atomic units for a given data size.
   */
  async getPrice(
    size: number,
    token: string,
    rpcUrl?: string,
    wallet?: any,
  ): Promise<number> {
    // For price estimation, we might not need a full wallet if we use the public API,
    // but WebIrys typically wants a provider. For estimation, we can use a dummy or skip wallet if the SDK allows.
    // Here we'll assume we have a way to get price.
    try {
      // Use node1 for public price check if possible, or initialize a minimal instance
      const irys = new WebIrys({
        url: RPCs.IRYS_NODE,
        token: token,
      })
      const price = await irys.getPrice(size)
      return price.toNumber()
    } catch (error) {
      console.error(`Failed to get Irys price for ${token}:`, error)
      throw error
    }
  }

  /**
   * Fund the Irys account.
   */
  async fund(amount: number, irys: WebIrys): Promise<any> {
    try {
      const fundTx = await irys.fund(amount)
      return fundTx
    } catch (error) {
      console.error("Irys funding failed:", error)
      throw error
    }
  }

  /**
   * Upload data to Arweave via Irys.
   */
  async upload(
    data: Uint8Array,
    tags: { name: string; value: string }[],
    irys: WebIrys,
  ): Promise<string> {
    try {
      const receipt = await irys.upload(data as any, { tags })
      return receipt.id
    } catch (error) {
      console.error("Irys upload failed:", error)
      throw error
    }
  }
}

export const irysService = new IrysService()
