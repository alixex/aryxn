// apps/web/src/lib/bridge/bridge-errors.ts

/**
 * Bridge-specific error types
 */
export const BridgeErrorType = {
  // Route/Quote errors
  NO_ROUTE_FOUND: "NO_ROUTE_FOUND",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  SLIPPAGE_TOO_HIGH: "SLIPPAGE_TOO_HIGH",

  // Execution errors
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  BRIDGE_FAILED: "BRIDGE_FAILED",
  BRIDGE_TIMEOUT: "BRIDGE_TIMEOUT",
  TX_REJECTED: "TX_REJECTED",

  // Validation errors
  INVALID_CHAIN: "INVALID_CHAIN",
  INVALID_TOKEN: "INVALID_TOKEN",
  INVALID_ADDRESS: "INVALID_ADDRESS",
  UNSUPPORTED_PAIR: "UNSUPPORTED_PAIR",

  // API errors
  LIFI_API_ERROR: "LIFI_API_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",

  // Unknown
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const

export type BridgeErrorType =
  (typeof BridgeErrorType)[keyof typeof BridgeErrorType]

interface BridgeError {
  type: BridgeErrorType
  message: string
  originalError?: Error
}

/**
 * Map error to user-friendly message
 */
export function mapBridgeError(error: unknown): BridgeError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Balance errors
    if (
      message.includes("insufficient") ||
      message.includes("balance") ||
      message.includes("low balance")
    ) {
      return {
        type: BridgeErrorType.INSUFFICIENT_BALANCE,
        message: "Insufficient balance for this swap",
        originalError: error,
      }
    }

    // Route/quote errors
    if (message.includes("no route") || message.includes("no path")) {
      return {
        type: BridgeErrorType.NO_ROUTE_FOUND,
        message: "No route found for this swap pair",
        originalError: error,
      }
    }

    if (message.includes("slippage")) {
      return {
        type: BridgeErrorType.SLIPPAGE_TOO_HIGH,
        message:
          "Price impact too high. Reduce amount or increase slippage tolerance",
        originalError: error,
      }
    }

    // Bridge errors
    if (
      message.includes("bridge") ||
      message.includes("failed to bridge") ||
      message.includes("bridge timeout")
    ) {
      return {
        type: BridgeErrorType.BRIDGE_FAILED,
        message:
          "Bridge operation failed. Please retry or check bridge provider status",
        originalError: error,
      }
    }

    // TX errors
    if (
      message.includes("rejected") ||
      message.includes("denied") ||
      message.includes("user denied")
    ) {
      return {
        type: BridgeErrorType.TX_REJECTED,
        message: "Transaction was rejected. Please try again",
        originalError: error,
      }
    }

    // Address/validation errors
    if (
      message.includes("invalid address") ||
      message.includes("bad address") ||
      message.includes("address checksum")
    ) {
      return {
        type: BridgeErrorType.INVALID_ADDRESS,
        message: "Invalid destination address format",
        originalError: error,
      }
    }

    // Amount errors
    if (
      message.includes("amount too small") ||
      message.includes("min") ||
      message.includes("dust")
    ) {
      return {
        type: BridgeErrorType.INVALID_AMOUNT,
        message: "Amount is too small for this chain",
        originalError: error,
      }
    }

    // Network errors
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout") ||
      message.includes("enotfound")
    ) {
      return {
        type: BridgeErrorType.NETWORK_ERROR,
        message: "Network error. Please check your connection and retry",
        originalError: error,
      }
    }

    // Li.Fi API errors
    if (message.includes("lifi") || message.includes("api")) {
      return {
        type: BridgeErrorType.LIFI_API_ERROR,
        message: "Bridge service temporarily unavailable. Please retry later",
        originalError: error,
      }
    }

    return {
      type: BridgeErrorType.UNKNOWN_ERROR,
      message: error.message,
      originalError: error,
    }
  }

  if (typeof error === "string") {
    return {
      type: BridgeErrorType.UNKNOWN_ERROR,
      message: error,
    }
  }

  return {
    type: BridgeErrorType.UNKNOWN_ERROR,
    message: "An unexpected error occurred",
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(errorType: BridgeErrorType): boolean {
  const retryableErrors: BridgeErrorType[] = [
    BridgeErrorType.BRIDGE_TIMEOUT,
    BridgeErrorType.NETWORK_ERROR,
    BridgeErrorType.TIMEOUT,
    BridgeErrorType.LIFI_API_ERROR,
  ]
  return retryableErrors.includes(errorType)
}

/**
 * Get retry delay in milliseconds
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s
  return Math.min(1000 * Math.pow(2, attemptNumber - 1), 10000)
}
