/**
 * Hook for managing ERC20 token approvals
 */

import { useEffect } from "react"
import {
  useConnection,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi"
import type { Address } from "@aryxn/wallet-core"
import { ERC20_ABI } from "@/lib/contracts/multi-hop-swapper-abi"

interface UseTokenApprovalParams {
  tokenAddress: Address
  spenderAddress: Address
  requiredAmount: bigint
  enabled?: boolean
}

interface TokenApprovalResult {
  isApproved: boolean
  allowance: bigint
  needsApproval: boolean
  isApproving: boolean
  isWaitingForApproval: boolean
  approvalError: Error | null
  approve: () => void
  refetch: () => void
}

/**
 * Manage token approval for a spender
 * Automatically checks if approval is needed and provides approve function
 */
export function useTokenApproval({
  tokenAddress,
  spenderAddress,
  requiredAmount,
  enabled = true,
}: UseTokenApprovalParams): TokenApprovalResult {
  const { address: accountAddress } = useConnection()

  // Read current allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      accountAddress && enabled ? [accountAddress, spenderAddress] : undefined,
    query: {
      enabled: enabled && !!accountAddress,
    },
  })

  // Write contract for approval
  const {
    writeContract,
    data: approvalHash,
    isPending: isApproving,
    error: approvalError,
  } = useWriteContract()

  // Wait for approval transaction
  const { isLoading: isWaitingForApproval, isSuccess: approvalSuccess } =
    useWaitForTransactionReceipt({
      hash: approvalHash,
    })

  // Refetch allowance after successful approval
  useEffect(() => {
    if (approvalSuccess) {
      refetchAllowance()
    }
  }, [approvalSuccess, refetchAllowance])

  const allowanceValue = allowance ?? 0n
  const isApproved = allowanceValue >= requiredAmount
  const needsApproval = !isApproved && requiredAmount > 0n

  const approve = () => {
    if (!accountAddress || !enabled) {
      console.warn("Cannot approve: wallet not connected or disabled")
      return
    }

    // Approve infinite amount (common pattern to avoid multiple approvals)
    const MAX_UINT256 = 2n ** 256n - 1n

    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spenderAddress, MAX_UINT256],
    })
  }

  const refetch = () => {
    refetchAllowance()
  }

  return {
    isApproved,
    allowance: allowanceValue,
    needsApproval,
    isApproving,
    isWaitingForApproval,
    approvalError: approvalError as Error | null,
    approve,
    refetch,
  }
}

/**
 * Simplified hook that only checks if approval is needed
 */
export function useIsTokenApproved(
  tokenAddress: Address,
  spenderAddress: Address,
  requiredAmount: bigint,
): boolean {
  const { isApproved } = useTokenApproval({
    tokenAddress,
    spenderAddress,
    requiredAmount,
  })
  return isApproved
}
