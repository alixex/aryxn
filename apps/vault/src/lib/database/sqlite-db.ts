import { db as vaultDb, initializeVaultDb } from "./vault/db"
import { getStorageInfo } from "./vault/diagnostics"

export {
  deleteOpfsDatabaseFile,
  getOpfsFilesWithSize,
  initDatabase,
  initializeDatabase,
} from "@aryxn/storage"

// The unified db object with schema support
export const db = {
  ...vaultDb,
  getStorageInfo,
}

// Maintain naming compatibility for hooks
export { initializeVaultDb as initDatabaseWithSchema }
