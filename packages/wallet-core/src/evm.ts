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

/**
 * Get ETH balance for an address
 * @param provider - EVM provider
 * @param address - The address to query
 * @returns Balance in wei as bigint
 */
export const getEvmBalance = async (
  provider: JsonRpcProvider,
  address: string,
): Promise<bigint> => {
  return await provider.getBalance(address)
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
