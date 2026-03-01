/**
 * Upload Hooks - File Upload and Synchronization
 *
 * Hooks for managing file uploads and synchronization:
 * - File upload to Arweave with payment handling
 * - File metadata sync from Arweave
 *
 * Handles both encryption and payment token management for uploads.
 */

export { useUploadHandler } from "./use-upload-handler"
export type { UploadHandlerResult } from "./use-upload-handler"
export { useFileSync } from "./use-file-sync"
