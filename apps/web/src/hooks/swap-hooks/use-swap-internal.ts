/**
 * Swap hook for internal wallet accounts
 * Uses ethers.js with internal wallet private keys instead of wagmi
 */

import { useState, useCallback, useEffect } from "react"
import type { Address, WalletRecord } from "@aryxn/wallet-core"
import { Chains } from "@aryxn/chain-constants"
import {
  MULTI_HOP_SWAPPER_ABI,
  ERC20_ABI,
} from "@/lib/contracts/multi-hop-swapper-abi"
import {
  createEvmProvider,
  createEvmWallet,
  createEvmContract,
  MaxUint256,
} from "@aryxn/wallet-core"
import { MULTI_HOP_SWAPPER_ADDRESS } from "@/lib/contracts/addresses"
import {
  parseTokenAmount,
  formatTokenAmount,
  getTokenByAddress,
} from "@/lib/contracts/token-config"
import { useInternal } from "@/hooks/account-hooks"
import { getEthereumRpcUrl } from "@/lib/chain/rpc-config"
import { useBridgeHistory } from "@/lib/store/bridge-history"

export const SwapState = {
  IDLE: "idle",
  FETCHING_QUOTE: "fetching_quote",
  NEEDS_APPROVAL: "needs_approval",
  APPROVING: "approving",
  READY: "ready",
  SWAPPING: "swapping",
  CONFIRMING: "confirming",
  SUCCESS: "success",
  ERROR: "error",
} as const

export type SwapState = (typeof SwapState)[keyof typeof SwapState]

interface UseInternalSwapParams {
  inputToken: Address
  outputToken: Address
  inputAmount: string
  decimalsIn: number
  decimalsOut: number
  slippage: number
}

export function useInternalSwap({
  inputToken,
  outputToken,
  inputAmount,
  decimalsIn,
  decimalsOut,
  slippage,
}: UseInternalSwapParams) {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
  const walletManager = useInternal()
  const addTransaction = useBridgeHistory((state) => state.addTransaction)
  const [swapState, setSwapState] = useState<SwapState>(SwapState.IDLE)
  const [error, setError] = useState<string>("")
  const [inputBalance, setInputBalance] = useState<bigint>(0n)
  const [outputAmount, setOutputAmount] = useState<string>("")
  const [quote, setQuote] = useState<any>(null)
  const [gasPrice, setGasPrice] = useState<string>("")
  const [gasEstimate] = useState<bigint>(0n)
  const [swapHash, setSwapHash] = useState<string | undefined>(undefined)
  const [swapSuccess, setSwapSuccess] = useState(false)
  const [allowance, setAllowance] = useState<bigint>(0n)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  // Parse input amount
  const amountIn =
    inputAmount && !isNaN(parseFloat(inputAmount))
      ? parseTokenAmount(inputAmount, decimalsIn)
      : 0n

  // Check if wallet is ready (internal account with Ethereum chain)
  const isWalletReady =
    walletManager.isUnlocked &&
    !!walletManager.activeAddress &&
    !!walletManager.activeWallet &&
    walletManager.wallets.find(
      (w: WalletRecord) => w.address === walletManager.activeAddress,
    )?.chain === Chains.ETHEREUM

  // Get ethers provider and signer
  const getProviderAndSigner = useCallback(async () => {
    if (!isWalletReady || !walletManager.activeWallet) {
      return null
    }

    const provider = createEvmProvider(getEthereumRpcUrl())
    // Use the active account's private key
    const privateKey = walletManager.activeWallet as string
    const wallet = createEvmWallet(privateKey, provider)

    return { provider, wallet }
  }, [isWalletReady, walletManager.activeWallet])

  const ensureSwapperReady = useCallback(async () => {
    if (MULTI_HOP_SWAPPER_ADDRESS.toLowerCase() === ZERO_ADDRESS) {
      setError("Swap contract is not configured")
      return null
    }

    const result = await getProviderAndSigner()
    if (!result) {
      return null
    }

    const { provider, wallet } = result
    const swapperCode = await provider.getCode(MULTI_HOP_SWAPPER_ADDRESS)

    if (!swapperCode || swapperCode === "0x") {
      setError("Swap contract is not deployed on the current network")
      return null
    }

    return { provider, wallet }
  }, [getProviderAndSigner])

  // Fetch token balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!isWalletReady || !walletManager.activeAddress) return

      const result = await getProviderAndSigner()
      if (!result) return

      const { provider, wallet } = result
      const tokenContract = createEvmContract(inputToken, ERC20_ABI, provider)

      try {
        const balance = await tokenContract.balanceOf(wallet.address)
        setInputBalance(BigInt(balance.toString()))
        setLastUpdated(Date.now())
      } catch (err) {
        console.error("Failed to fetch balance:", err)
        setInputBalance(0n)
      }
    }

    fetchBalance()
  }, [
    isWalletReady,
    walletManager.activeAddress,
    inputToken,
    getProviderAndSigner,
  ])

  // Fetch allowance
  useEffect(() => {
    const fetchAllowance = async () => {
      if (!isWalletReady || !walletManager.activeAddress || amountIn === 0n)
        return

      const result = await getProviderAndSigner()
      if (!result) return

      const { provider, wallet } = result
      const tokenContract = createEvmContract(inputToken, ERC20_ABI, provider)

      try {
        const currentAllowance = await tokenContract.allowance(
          wallet.address,
          MULTI_HOP_SWAPPER_ADDRESS,
        )
        setAllowance(BigInt(currentAllowance.toString()))
      } catch (err) {
        console.error("Failed to fetch allowance:", err)
        setAllowance(0n)
      }
    }

    fetchAllowance()
  }, [
    isWalletReady,
    walletManager.activeAddress,
    inputToken,
    amountIn,
    getProviderAndSigner,
  ])

  // Fetch swap quote
  useEffect(() => {
    const fetchQuote = async () => {
      if (!isWalletReady || amountIn === 0n) {
        setOutputAmount("")
        setQuote(null)
        return
      }

      const result = await ensureSwapperReady()
      if (!result) return

      setSwapState(SwapState.FETCHING_QUOTE)

      const { wallet } = result
      const swapperContract = createEvmContract(
        MULTI_HOP_SWAPPER_ADDRESS,
        MULTI_HOP_SWAPPER_ABI,
        wallet,
      )

      try {
        const routeData = await swapperContract.getOptimalRoute(
          inputToken,
          outputToken,
          amountIn,
        )

        const [route, expectedOutput] = routeData

        // Calculate minimum output with slippage
        const slippageBps = BigInt(Math.floor(slippage * 100))
        const minimumOutput =
          (BigInt(expectedOutput.toString()) * (10000n - slippageBps)) / 10000n

        const quoteData = {
          route,
          expectedOutput: BigInt(expectedOutput.toString()),
          minimumOutput,
          formattedOutput: formatTokenAmount(expectedOutput, decimalsOut),
          formattedMinimumOutput: formatTokenAmount(minimumOutput, decimalsOut),
        }

        setQuote(quoteData)
        setOutputAmount(quoteData.formattedOutput)
        setError("")
      } catch (err: any) {
        console.error("Failed to fetch quote:", err)
        setError(err.message || "Failed to fetch quote")
        setQuote(null)
        setOutputAmount("")
      }
    }

    fetchQuote()
  }, [
    isWalletReady,
    inputToken,
    outputToken,
    amountIn,
    decimalsOut,
    slippage,
    ensureSwapperReady,
  ])

  // Update swap state based on conditions
  useEffect(() => {
    if (!isWalletReady) {
      setSwapState(SwapState.IDLE)
      return
    }

    if (swapSuccess) {
      setSwapState(SwapState.SUCCESS)
      return
    }

    if (error && swapState !== SwapState.FETCHING_QUOTE) {
      setSwapState(SwapState.ERROR)
      return
    }

    if (amountIn > 0n && allowance < amountIn) {
      setSwapState(SwapState.NEEDS_APPROVAL)
      return
    }

    if (quote && amountIn > 0n) {
      setSwapState(SwapState.READY)
      return
    }

    setSwapState(SwapState.IDLE)
  }, [isWalletReady, amountIn, allowance, quote, swapSuccess, error, swapState])

  // Fetch gas price
  useEffect(() => {
    const fetchGasPrice = async () => {
      const result = await getProviderAndSigner()
      if (!result) return

      const { provider } = result

      try {
        const feeData = await provider.getFeeData()
        if (feeData.gasPrice) {
          setGasPrice((Number(feeData.gasPrice) / 1e9).toFixed(2))
        }
      } catch (err) {
        console.error("Failed to fetch gas price:", err)
      }
    }

    fetchGasPrice()
    const interval = setInterval(fetchGasPrice, 10000)
    return () => clearInterval(interval)
  }, [getProviderAndSigner])

  // Approve token
  const approve = useCallback(async () => {
    if (!isWalletReady) {
      setError("Wallet not ready")
      return
    }

    const result = await ensureSwapperReady()
    if (!result) {
      return
    }

    const { wallet: internalWallet } = result || {}

    if (!internalWallet) {
      setError("Failed to get wallet")
      return
    }

    const tokenContract = createEvmContract(
      inputToken,
      ERC20_ABI,
      internalWallet,
    )

    try {
      setSwapState(SwapState.APPROVING)
      setError("")

      const MAX_UINT256 = MaxUint256
      const tx = await tokenContract.approve(
        MULTI_HOP_SWAPPER_ADDRESS,
        MAX_UINT256,
      )

      await tx.wait()

      // Refresh allowance
      const newAllowance = await tokenContract.allowance(
        internalWallet.address,
        MULTI_HOP_SWAPPER_ADDRESS,
      )
      setAllowance(BigInt(newAllowance.toString()))

      setSwapState(SwapState.READY)
    } catch (err: any) {
      console.error("Approval failed:", err)
      setError(err.message || "Approval failed")
      setSwapState(SwapState.ERROR)
    }
  }, [isWalletReady, inputToken, ensureSwapperReady])

  // Execute swap
  const executeSwap = useCallback(async () => {
    if (!quote || !isWalletReady || amountIn === 0n) {
      setError("Invalid swap parameters")
      return
    }

    // Check balance
    if (inputBalance < amountIn) {
      setError("Insufficient balance")
      return
    }

    const result = await ensureSwapperReady()
    if (!result) {
      return
    }

    const { wallet: internalWallet } = result || {}

    if (!internalWallet) {
      setError("Failed to get wallet")
      return
    }

    const swapperContract = createEvmContract(
      MULTI_HOP_SWAPPER_ADDRESS,
      MULTI_HOP_SWAPPER_ABI,
      internalWallet,
    )

    try {
      setSwapState(SwapState.SWAPPING)
      setError("")
      setSwapSuccess(false)

      const tx = await swapperContract.swap(
        inputToken,
        outputToken,
        amountIn,
        quote.minimumOutput,
        quote.route,
      )

      setSwapHash(tx.hash)
      setSwapState(SwapState.CONFIRMING)

      const receipt = await tx.wait()

      if (receipt.status === 1) {
        setSwapSuccess(true)
        setSwapState(SwapState.SUCCESS)

        const inputTokenInfo = getTokenByAddress(inputToken)
        const outputTokenInfo = getTokenByAddress(outputToken)
        const inputSymbol = inputTokenInfo?.symbol ?? "UNKNOWN"
        const outputSymbol = outputTokenInfo?.symbol ?? "UNKNOWN"

        addTransaction({
          id: crypto.randomUUID(),
          type: "SWAP",
          status: "COMPLETED",
          description: `Swap ${inputAmount || "0"} ${inputSymbol} to ${quote.formattedOutput} ${outputSymbol}`,
          timestamp: Date.now(),
          hash: tx.hash,
          fromChain: Chains.ETHEREUM,
          toChain: Chains.ETHEREUM,
          amount: inputAmount || "0",
          token: `${inputSymbol}/${outputSymbol}`,
        })

        const tokenContract = createEvmContract(
          inputToken,
          ERC20_ABI,
          internalWallet,
        )
        const balance = await tokenContract.balanceOf(internalWallet.address)
        setInputBalance(BigInt(balance.toString()))
        setLastUpdated(Date.now())
      } else {
        throw new Error("Transaction failed")
      }
    } catch (err: any) {
      console.error("Swap failed:", err)
      setError(err.message || "Swap failed")
      setSwapState(SwapState.ERROR)
    }
  }, [
    quote,
    isWalletReady,
    amountIn,
    inputBalance,
    inputToken,
    outputToken,
    inputAmount,
    addTransaction,
    ensureSwapperReady,
  ])

  const formattedBalance = formatTokenAmount(inputBalance, decimalsIn)
  const needsApproval = amountIn > 0n && allowance < amountIn
  const hasInsufficientBalance = inputBalance < amountIn && amountIn > 0n

  return {
    swapState,
    outputAmount,
    quote,
    inputBalance,
    formattedBalance,
    hasInsufficientBalance,
    needsApproval,
    approve,
    gasEstimate: gasEstimate.toString(),
    gasPrice,
    error,
    executeSwap,
    swapHash,
    swapSuccess,
    isWalletReady,
    lastUpdated,
  }
}
