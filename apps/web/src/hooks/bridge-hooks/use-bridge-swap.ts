// apps/web/src/hooks/bridge-hooks/use-bridge-swap.ts

import { useState, useCallback } from "react"
import { getLiFiClient } from "@/lib/bridge/lifi-client"
import { useBridgeHistory } from "@/lib/store/bridge-history"
import { mapBridgeError } from "@/lib/bridge/bridge-errors"
import type { LiFiRoute, BridgeSwapRecord } from "@/lib/bridge/route-types"
import { nanoid } from "nanoid"

interface UseBridgeSwapParams {
  fromChain: string
  toChain: string
  fromToken: string
  toToken: string

  fromAmount: string
  toAmount: string
  feePercentage: number
  bridgeProvider: string
  estimatedTime: number
  destinationAddress?: string
}

interface UseBridgeSwapResult {
  executing: boolean
  status:
    | "idle"
    | "signing"
    | "broadcasting"
    | "confirming"
    | "complete"
    | "error"
  step: number
  totalSteps: number
  currentTxHash?: string
  statusMessageKey?: string
  error?: string

  execute: (route: LiFiRoute) => Promise<BridgeSwapRecord>
  retry: () => Promise<BridgeSwapRecord>
}

/**
 * Hook to execute bridge swaps
 * Handles multi-step transactions, signing, broadcasting, and status polling
 */
export function useBridgeSwap(
  params: UseBridgeSwapParams,
): UseBridgeSwapResult {
  const [executing, setExecuting] = useState(false)
  const [status, setStatus] = useState<UseBridgeSwapResult["status"]>("idle")
  const [step, setStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [currentTxHash, setCurrentTxHash] = useState<string>()
  const [statusMessageKey, setStatusMessageKey] = useState<string>()
  const [error, setError] = useState<string>()
  const [lastRoute, setLastRoute] = useState<LiFiRoute | null>(null)
  const [lastSwapRecord, setLastSwapRecord] = useState<BridgeSwapRecord | null>(
    null,
  )

  const { addBridgeSwap, updateBridgeSwapStatus } = useBridgeHistory()

  const execute = useCallback(
    async (route: LiFiRoute): Promise<BridgeSwapRecord> => {
      try {
        setExecuting(true)
        setStatus("signing")
        setError(undefined)
        setStatusMessageKey(undefined)
        setStep(1)

        const swapId = nanoid()
        const client = getLiFiClient()

        const validation = await client.validateRoute(route.id)
        if (!validation.valid) {
          throw new Error(
            validation.errors.join("; ") || "Route is no longer valid",
          )
        }

        // 1. Create record
        const swapRecord: BridgeSwapRecord = {
          id: swapId,
          type: "BRIDGE_SWAP",
          direction:
            params.toToken === "BTC" || params.toToken === "AR"
              ? "reverse"
              : "forward",
          status: "PENDING",

          fromChain: params.fromChain,
          toChain: params.toChain,
          fromToken: params.fromToken,
          toToken: params.toToken,

          fromAmount: params.fromAmount,
          toAmount: params.toAmount,
          feePercentage: params.feePercentage,

          bridgeProvider: params.bridgeProvider,
          estimatedTime: params.estimatedTime,

          txHashes: [],
          destinationAddress: params.destinationAddress,

          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        await addBridgeSwap(swapRecord)
        setLastSwapRecord(swapRecord)
        setLastRoute(route)

        // 2. Get execution steps from Li.Fi
        setStatus("broadcasting")
        setStep(2)

        const transactions = await client.getSteps(route.id)

        setTotalSteps(transactions.length)

        // 3. Execute each transaction
        const txHashes: string[] = []

        for (let i = 0; i < transactions.length; i++) {
          setStep(i + 1)

          try {
            // For now, we're storing the transaction data
            // Actual wallet integration happens here
            // This is a placeholder that gets replaced during Phase D
            const txHash = `pending-${nanoid()}`
            txHashes.push(txHash)
            setCurrentTxHash(txHash)

            // In production, this would call the wallet to sign and send
            // For now, just wait a bit to simulate
            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (stepError) {
            const mapped = mapBridgeError(stepError)
            throw new Error(`Step ${i + 1} failed: ${mapped.message}`)
          }
        }

        // 4. Update record with tx hashes
        setStatus("confirming")
        const completeRecord: BridgeSwapRecord = {
          ...swapRecord,
          txHashes,
          updatedAt: Date.now(),
        }

        await addBridgeSwap(completeRecord)

        // 5. Poll for completion
        let pollCount = 0
        const maxPolls = 120 // 120 * 5 seconds = 10 minutes
        let bridgeCompleted = false

        while (pollCount < maxPolls && !bridgeCompleted) {
          const statusResult = await client.getStatus(route.id, txHashes[0])
          setStatusMessageKey(statusResult.message)

          if (statusResult.status === "completed") {
            bridgeCompleted = true
            setStatus("complete")
            await updateBridgeSwapStatus(swapId, "COMPLETED")
          } else if (statusResult.status === "failed") {
            throw new Error("Bridge execution failed on destination chain")
          }

          pollCount++
          if (!bridgeCompleted) {
            await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds
          }
        }

        if (!bridgeCompleted) {
          throw new Error("Bridge confirmation timeout")
        }

        setExecuting(false)
        setStatusMessageKey(undefined)
        return completeRecord
      } catch (err) {
        const mapped = mapBridgeError(err)
        setError(mapped.message)
        setStatus("error")
        setExecuting(false)

        if (lastSwapRecord) {
          await updateBridgeSwapStatus(
            lastSwapRecord.id,
            "FAILED",
            mapped.message,
          )
        }

        throw err
      }
    },
    [params, addBridgeSwap, updateBridgeSwapStatus],
  )

  const retry = useCallback(async (): Promise<BridgeSwapRecord> => {
    if (!lastRoute) throw new Error("No last route to retry")
    return execute(lastRoute)
  }, [lastRoute, execute])

  return {
    executing,
    status,
    step,
    totalSteps,
    currentTxHash,
    statusMessageKey,
    error,

    execute,
    retry,
  }
}
