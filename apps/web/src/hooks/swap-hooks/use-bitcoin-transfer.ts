import { useCallback, useState } from "react"
import { Chains } from "@aryxn/chain-constants"
import { useWallet } from "@/hooks/account-hooks"
import {
  estimateBitcoinTransfer,
  sendBitcoinTransfer,
  type BitcoinTransferPreview,
} from "@/lib/chain/bitcoin-transfer"
import { useBridgeHistory } from "@/lib/store/bridge-history"
import { toast } from "sonner"

type DexSelectableAccount = {
  chain: string
  address: string
  alias?: string
  isExternal: boolean
}

export function useBitcoinTransfer(
  selectedAccount: DexSelectableAccount | null,
) {
  const wallet = useWallet()
  const addTransaction = useBridgeHistory((state) => state.addTransaction)
  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [preview, setPreview] = useState<BitcoinTransferPreview | null>(null)
  const [estimateError, setEstimateError] = useState<string>("")

  const mapBitcoinError = useCallback((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error"

    const lower = message.toLowerCase()
    if (lower.includes("insufficient")) {
      return "Insufficient BTC balance (including network fee)."
    }
    if (lower.includes("utxo")) {
      return "No spendable UTXO found for this BTC account."
    }
    if (lower.includes("address")) {
      return "Invalid BTC address format."
    }
    if (lower.includes("broadcast")) {
      return "Broadcast failed. Please retry in a few moments."
    }
    if (lower.includes("match selected btc account")) {
      return "Selected BTC account does not match current private key."
    }

    return message
  }, [])

  const estimate = useCallback(
    async (recipient: string, amountBtc: string) => {
      if (!selectedAccount || selectedAccount.chain !== Chains.BITCOIN) {
        setPreview(null)
        setEstimateError("")
        return null
      }

      if (selectedAccount.isExternal) {
        setPreview(null)
        setEstimateError("External Bitcoin wallet send is not supported yet")
        return null
      }

      if (!recipient || !amountBtc || Number.parseFloat(amountBtc) <= 0) {
        setPreview(null)
        setEstimateError("")
        return null
      }

      setEstimating(true)

      try {
        const result = await estimateBitcoinTransfer({
          fromAddress: selectedAccount.address,
          toAddress: recipient,
          amountBtc,
        })
        setPreview(result)
        setEstimateError("")
        return result
      } catch (error) {
        const message = mapBitcoinError(error)
        setPreview(null)
        setEstimateError(message)
        return null
      } finally {
        setEstimating(false)
      }
    },
    [selectedAccount, mapBitcoinError],
  )

  const transfer = useCallback(
    async (recipient: string, amountBtc: string) => {
      if (!selectedAccount || selectedAccount.chain !== Chains.BITCOIN) {
        toast.error("Please select a Bitcoin account first")
        return
      }

      if (selectedAccount.isExternal) {
        toast.error("External Bitcoin wallet send is not supported yet")
        return
      }

      const activeKey = wallet.internal.activeWallet
      if (!activeKey || typeof activeKey !== "string") {
        toast.error("Bitcoin private key not available")
        return
      }

      if (!recipient || !amountBtc || Number.parseFloat(amountBtc) <= 0) {
        toast.error("Invalid transfer parameters")
        return
      }

      setLoading(true)
      const toastId = toast.loading("Broadcasting BTC transaction...")

      try {
        const result = await sendBitcoinTransfer({
          fromAddress: selectedAccount.address,
          fromWif: activeKey,
          toAddress: recipient,
          amountBtc,
        })

        addTransaction({
          id: crypto.randomUUID(),
          type: "SEND",
          status: "PENDING",
          description: `Sent ${amountBtc} BTC to ${recipient.slice(0, 8)}...`,
          timestamp: Date.now(),
          hash: result.txid,
          amount: amountBtc,
          token: "BTC",
          fromChain: Chains.BITCOIN,
          toChain: Chains.BITCOIN,
        })

        toast.success("BTC transfer broadcasted", {
          id: toastId,
          description: `Tx: ${result.txid.slice(0, 10)}...`,
        })
      } catch (error: any) {
        const message = mapBitcoinError(error)
        toast.error("BTC transfer failed", {
          id: toastId,
          description: message,
        })
      } finally {
        setLoading(false)
      }
    },
    [
      selectedAccount,
      wallet.internal.activeWallet,
      addTransaction,
      mapBitcoinError,
    ],
  )

  return {
    estimate,
    transfer,
    loading,
    estimating,
    preview,
    estimateError,
  }
}
