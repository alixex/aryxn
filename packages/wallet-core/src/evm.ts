import {
  ethers,
  JsonRpcProvider,
  Wallet,
  Contract,
  type ContractRunner,
  type Interface,
  type InterfaceAbi,
} from "ethers"

/**
 * Creates a JSON RPC provider for EVM chains.
 */
export const createEvmProvider = (rpcUrl: string) => {
  return new JsonRpcProvider(rpcUrl)
}

import { BalanceResult } from "./types"

/**
 * Get ETH or ERC20 balance for an address
 * @param provider - EVM provider
 * @param address - The address to query
 * @param tokenAddress - Optional ERC20 token address
 * @returns BalanceResult
 */
export const getEvmBalance = async (
  provider: JsonRpcProvider,
  address: string,
  tokenAddress?: string,
): Promise<BalanceResult> => {
  try {
    if (tokenAddress) {
      // ERC20 Balance
      // We assume standard ERC20 ABI implies balanceOf, decimals, symbol
      // Minimal ABI for these 3 functions
      const abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
      ]

      const contract = new Contract(tokenAddress, abi, provider)

      const [balance, decimals, symbol] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals(),
        contract.symbol(),
      ])

      const formatted = ethers.formatUnits(balance, decimals)

      return {
        balance: balance.toString(),
        formatted: parseFloat(formatted).toFixed(6),
        symbol,
      }
    } else {
      // Native ETH Balance
      const balance = await provider.getBalance(address)
      const formatted = ethers.formatEther(balance)

      return {
        balance: balance.toString(),
        formatted: parseFloat(formatted).toFixed(6),
        symbol: "ETH",
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      balance: "0",
      formatted: "0",
      symbol: "ETH", // or ??? if token failed
      error: errorMessage,
    }
  }
}

/**
 * Creates an EVM wallet instance from a private key.
 */
export const createEvmWallet = (
  privateKey: string,
  provider?: JsonRpcProvider,
) => {
  return new Wallet(privateKey, provider)
}

/**
 * Creates an EVM contract instance.
 */
export const createEvmContract = (
  address: string,
  abi: Interface | InterfaceAbi,
  runner?: ContractRunner,
) => {
  return new Contract(address, abi, runner)
}

/**
 * Formats a BigInt or string wei value into ether string.
 */
export const formatEther = (wei: bigint | string) => {
  return ethers.formatEther(wei)
}

/**
 * Parses an ether string into a BigInt wei value.
 */
export const parseEther = (ether: string) => {
  return ethers.parseEther(ether)
}

/**
 * Formats a BigInt or string wei value into a decimal string using 18 decimals by default.
 */
export const formatUnits = (
  value: bigint | string,
  decimals?: number | string,
) => {
  return ethers.formatUnits(value, decimals)
}

/**
 * Parses a decimal string into a BigInt value using 18 decimals by default.
 */
export const parseUnits = (value: string, decimals?: number | string) => {
  return ethers.parseUnits(value, decimals)
}

/**
 * MaxUint256 constant from ethers.
 */
export const MaxUint256 = ethers.MaxUint256
