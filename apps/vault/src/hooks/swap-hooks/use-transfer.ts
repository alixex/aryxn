import { useState, useCallback } from "react"
import { useSendTransaction, useWriteContract } from "wagmi"
import { parseEther, parseUnits, isAddress } from "viem"
import { useWallet } from "@/hooks/account-hooks"
import {
  createEvmProvider,
  createEvmWallet,
  createEvmContract,
} from "@aryxn/wallet-core"
import { ERC20_ABI } from "@/lib/contracts/multi-hop-swapper-abi"
import { getEthereumRpcUrl } from "@/lib/chain"
import { type TokenInfo } from "@/lib/contracts/token-config"
import { useBridgeHistory } from "@/lib/store/bridge-history"
import { toast } from "sonner"

export function useTransfer() {
  const wallet = useWallet()
  const walletManager = wallet.internal
  const activeEvm = wallet.active.evm
  const { sendTransactionAsync: sendTransaction } = useSendTransaction()
  const { writeContractAsync: writeContract } = useWriteContract()
  const addTransaction = useBridgeHistory((state) => state.addTransaction)

  const [loading, setLoading] = useState(false)

  // Helper to determine if we are using internal wallet
  const isInternal = !!activeEvm && !activeEvm.isExternal

  const transfer = useCallback(
    async (token: TokenInfo, recipient: string, amount: string) => {
      if (!activeEvm) {
        toast.error("Please select an active account first")
        return
      }

      if (!amount || parseFloat(amount) <= 0 || !isAddress(recipient)) {
        toast.error("Invalid parameters")
        return
      }

      setLoading(true)
      const toastId = toast.loading("Processing transfer...")

      try {
        let hash = ""

        if (isInternal) {
          // Internal Wallet Logic
          if (
            walletManager.activeWallet &&
            typeof walletManager.activeWallet === "string"
          ) {
            const provider = createEvmProvider(getEthereumRpcUrl())
            const wallet = createEvmWallet(walletManager.activeWallet, provider)

            if (token.symbol === "ETH") {
              // Native Transfer
              const tx = await wallet.sendTransaction({
                to: recipient,
                value: parseEther(amount),
              })
              hash = tx.hash
              await tx.wait()
            } else {
              // ERC20 Transfer
              const contract = createEvmContract(
                token.address,
                ERC20_ABI,
                wallet,
              )
              const parsedAmount = parseUnits(amount, token.decimals)
              const tx = await contract.transfer(recipient, parsedAmount)
              hash = tx.hash
              await tx.wait()
            }
          }
        } else {
          // External Wallet Logic (Wagmi)
          if (token.symbol === "ETH") {
            hash = await sendTransaction({
              to: recipient as `0x${string}`,
              value: parseEther(amount),
            })
          } else {
            hash = await writeContract({
              address: token.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "transfer",
              args: [
                recipient as `0x${string}`,
                parseUnits(amount, token.decimals),
              ],
            })
          }
        }

        if (hash) {
          toast.success("Transfer sent!", { id: toastId })
          addTransaction({
            id: crypto.randomUUID(),
            userAddress: activeEvm.address,
            type: "SEND",
            status: "COMPLETED", // Simplified for now, typically starts as PENDING
            description: `Sent ${amount} ${token.symbol} to ${recipient.slice(0, 6)}...`,
            timestamp: Date.now(),
            hash,
            amount,
            token: token.symbol,
          })
        }
      } catch (error: any) {
        console.error("Transfer failed", error)
        toast.error("Transfer failed: " + (error.message || "Unknown error"), {
          id: toastId,
        })
      } finally {
        setLoading(false)
      }
    },
    [
      activeEvm,
      isInternal,
      walletManager,
      sendTransaction,
      writeContract,
      addTransaction,
    ],
  )

  return {
    transfer,
    loading,
  }
}
