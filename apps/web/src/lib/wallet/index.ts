/**
 * Wallet Operations
 *
 * Export wallet export/import, vault export, and manifest update utilities.
 */

// Wallet export
export type { ChainType, ExportOptions, ExportResult } from "./wallet-export"
export { prepareExport, downloadFile, exportWallet } from "./wallet-export"

// Vault export/import
export type { VaultExportData } from "./vault-export"
export {
  exportVault,
  exportVaultToFile,
  importVaultFromFile,
} from "./vault-export"

// Config export/import
export type { ConfigExport } from "./config-import-export"
export {
  exportConfig,
  importConfig,
  validateConfig,
  downloadConfig,
  readConfigFromFile,
} from "./config-import-export"

// Manifest updates (from @/lib/file)
export {
  manifestUpdater,
  scheduleManifestUpdate,
  forceManifestUpdate,
} from "@/lib/file"
