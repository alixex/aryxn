/**
 * Vault Hooks - Internal Wallet (Vault) Operations
 *
 * Specialized hooks for internal wallet management including:
 * - Vault operations (create, import, export)
 * - Wallet encryption and storage
 * - Key management and recovery
 *
 * These hooks handle sensitive cryptographic operations specific to the internal vault system.
 */

export { useVault } from "./use-vault"
export { useWalletStorage } from "./use-wallet-storage"
export { useWalletOps } from "./use-wallet-ops"
