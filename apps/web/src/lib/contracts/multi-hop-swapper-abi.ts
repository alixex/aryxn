/**
 * ABI definitions for MultiHopSwapper and ERC20 contracts
 */

import type { Abi } from "@aryxn/wallet-core"

/**
 * MultiHopSwapper Contract ABI
 * Handles multi-hop token swaps through Uniswap V3
 */
export const MULTI_HOP_SWAPPER_ABI = [
  {
    type: "function",
    name: "swap",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct DataTypes.SwapParams",
        components: [
          { name: "tokenIn", type: "address", internalType: "address" },
          { name: "tokenOut", type: "address", internalType: "address" },
          { name: "amountIn", type: "uint256", internalType: "uint256" },
          { name: "minAmountOut", type: "uint256", internalType: "uint256" },
          { name: "recipient", type: "address", internalType: "address" },
          { name: "deadline", type: "uint256", internalType: "uint256" },
          { name: "protection", type: "uint8", internalType: "enum DataTypes.ProtectionLevel" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getOptimalRoute",
    inputs: [
      { name: "tokenIn", type: "address", internalType: "address" },
      { name: "tokenOut", type: "address", internalType: "address" },
      { name: "amountIn", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      { name: "route", type: "address[]", internalType: "address[]" },
      { name: "estimatedOut", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "estimateSwap",
    inputs: [
      { name: "tokenIn", type: "address", internalType: "address" },
      { name: "tokenOut", type: "address", internalType: "address" },
      { name: "amountIn", type: "uint256", internalType: "uint256" },
      { name: "route", type: "address[]", internalType: "address[]" },
    ],
    outputs: [
      { name: "estimatedOut", type: "uint256", internalType: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "SwapExecuted",
    inputs: [
      {
        name: "user",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "tokenIn",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "tokenOut",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amountIn",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "amountOut",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "InsufficientOutput",
    inputs: [
      { name: "expected", type: "uint256", internalType: "uint256" },
      { name: "actual", type: "uint256", internalType: "uint256" },
    ],
  },
  {
    type: "error",
    name: "InvalidPath",
    inputs: [],
  },
] as const satisfies Abi

/**
 * Standard ERC20 Token ABI
 * For balance queries, approvals, and transfers
 */
export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "spender", type: "address", internalType: "address" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true, internalType: "address" },
      { name: "to", type: "address", indexed: true, internalType: "address" },
      {
        name: "value",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "spender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "value",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
  },
] as const satisfies Abi
