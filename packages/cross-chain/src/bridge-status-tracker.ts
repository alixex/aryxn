import { getStatus, type ChainId, type StatusResponse } from "@lifi/sdk"

/**
 * Bridge transaction status
 */
export type BridgeStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED"

/**
 * Bridge transaction tracking info
 */
export interface BridgeTrackingInfo {
  txHash: string
  fromChainId: ChainId
  toChainId: ChainId
  status: BridgeStatus
  substatus?: string
  destTxHash?: string
  startTime: number
  lastUpdate: number
}

/**
 * Rate limit info stored in localStorage
 */
interface RateLimitInfo {
  [txHash: string]: number // txHash -> next allowed time (timestamp)
}

const RATE_LIMIT_KEY = "aryxn-bridge-status-rate-limit"
const RATE_LIMIT_DURATION = 60000 // 60 seconds

/**
 * Bridge Transaction Status Checker
 * Manual status checking with rate limiting (60s cooldown)
 */
export class BridgeStatusTracker {
  /**
   * Check if a status refresh is allowed (rate limit check)
   */
  static canRefresh(txHash: string): boolean {
    const rateLimits = this.getRateLimits()
    const nextAllowedTime = rateLimits[txHash] || 0
    return Date.now() >= nextAllowedTime
  }

  /**
   * Get remaining cooldown time in seconds
   */
  static getRemainingCooldown(txHash: string): number {
    const rateLimits = this.getRateLimits()
    const nextAllowedTime = rateLimits[txHash] || 0
    const remaining = Math.max(0, nextAllowedTime - Date.now())
    return Math.ceil(remaining / 1000)
  }

  /**
   * Update rate limit for a transaction
   */
  private static updateRateLimit(txHash: string): void {
    const rateLimits = this.getRateLimits()
    rateLimits[txHash] = Date.now() + RATE_LIMIT_DURATION

    // Clean up old entries (older than 1 hour)
    const cutoff = Date.now() - 3600000
    Object.keys(rateLimits).forEach((key) => {
      if (rateLimits[key] < cutoff) {
        delete rateLimits[key]
      }
    })

    try {
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateLimits))
    } catch {
      // localStorage unavailable (Node.js / SSR / React Native)
    }
  }

  /**
   * Get rate limits from localStorage
   */
  private static getRateLimits(): RateLimitInfo {
    try {
      const stored = localStorage.getItem(RATE_LIMIT_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  /**
   * Check transaction status manually (with rate limiting)
   */
  static async checkStatus(
    txHash: string,
    fromChainId: ChainId,
    toChainId: ChainId,
  ): Promise<BridgeTrackingInfo> {
    // Check rate limit
    if (!this.canRefresh(txHash)) {
      throw new Error(
        `Please wait ${this.getRemainingCooldown(txHash)}s before refreshing again`,
      )
    }

    try {
      // Fetch status from Li.Fi
      const response: StatusResponse = await getStatus({
        txHash,
        fromChain: fromChainId,
        toChain: toChainId,
      })

      // Update rate limit
      this.updateRateLimit(txHash)

      const trackingInfo: BridgeTrackingInfo = {
        txHash,
        fromChainId,
        toChainId,
        status: "PENDING",
        substatus: response.substatus,
        startTime: Date.now(),
        lastUpdate: Date.now(),
      }

      // Map Li.Fi status to our status
      switch (response.status) {
        case "DONE":
          trackingInfo.status = "COMPLETED"
          if (response.receiving && "txHash" in response.receiving) {
            trackingInfo.destTxHash = response.receiving.txHash
          }
          break

        case "FAILED":
          trackingInfo.status = "FAILED"
          break

        case "PENDING":
        case "NOT_FOUND":
        default:
          trackingInfo.status = "IN_PROGRESS"
      }

      return trackingInfo
    } catch (error) {
      console.error("[BridgeStatusTracker] Failed to check status:", error)
      throw error
    }
  }

  /**
   * Clear rate limit for specific transaction (e.g., after completion)
   */
  static clearRateLimit(txHash: string): void {
    const rateLimits = this.getRateLimits()
    delete rateLimits[txHash]
    try {
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateLimits))
    } catch {
      // localStorage unavailable (Node.js / SSR / React Native)
    }
  }

  /**
   * Clear all rate limits
   */
  static clearAllRateLimits(): void {
    try {
      localStorage.removeItem(RATE_LIMIT_KEY)
    } catch {
      // localStorage unavailable (Node.js / SSR / React Native)
    }
  }
}
