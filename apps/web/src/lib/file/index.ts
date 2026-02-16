/**
 * File Management and Synchronization
 *
 * Export all file-related utilities for managing file indices,
 * synchronization, and manifest updates.
 */

export type {
  FileIndex,
  Folder,
  FolderTreeNode,
  SearchOptions,
} from "./file-manager"
export {
  calculateFileHash,
  calculateDataHash,
  uploadFile,
  uploadFiles,
  searchFiles,
  updateFileMetadata,
  updateFileContent,
  createFolder,
  getFolderTree,
  deleteFile,
  getFileById,
} from "./file-manager"

export type { FileManifest, IncrementalManifest } from "./file-sync"
export {
  estimateManifestSize,
  uploadIncrementalManifest,
  downloadManifestByTxId,
  mergeManifestChain,
  downloadManifest,
  syncFilesFromArweave,
  updateManifestAfterUpload,
} from "./file-sync"

export {
  queryFileTransactions,
  scheduleAutoSync,
  syncFilesFromArweaveDirect,
  calculateFileHashFromArweave,
} from "./file-sync-direct"

export {
  manifestUpdater,
  scheduleManifestUpdate,
  forceManifestUpdate,
} from "./manifest-updater"
