// OPFS 分片缓存读写
async function getOpfsChunkDirHandle(
  txId: string,
  ownerAddress: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  const opfsRoot = await (navigator.storage as any).getDirectory()
  const cacheDir = await opfsRoot.getDirectoryHandle("chunked-cache", {
    create,
  })
  const taskDir = await cacheDir.getDirectoryHandle(
    `${encodeURIComponent(ownerAddress)}_${encodeURIComponent(txId)}`,
    { create },
  )
  return taskDir
}

export async function writeChunkToCache(
  txId: string,
  ownerAddress: string,
  chunkIndex: number,
  chunkData: Uint8Array,
) {
  const taskDir = await getOpfsChunkDirHandle(txId, ownerAddress, true)
  const fileHandle = await taskDir.getFileHandle(`chunk_${chunkIndex}.bin`, {
    create: true,
  })
  const writable = await fileHandle.createWritable()
  await writable.write(chunkData as any)
  await writable.close()
}

export async function readChunkFromCache(
  txId: string,
  ownerAddress: string,
  chunkIndex: number,
): Promise<Uint8Array | null> {
  try {
    const taskDir = await getOpfsChunkDirHandle(txId, ownerAddress, false)
    const fileHandle = await taskDir.getFileHandle(`chunk_${chunkIndex}.bin`, {
      create: false,
    })
    const file = await fileHandle.getFile()
    return new Uint8Array(await file.arrayBuffer())
  } catch {
    return null
  }
}
import type { ChunkedResourceProgress } from "./resource-cache"
import {
  upsertChunkedResourceProgress,
  getIncompleteChunkedResourceProgress,
} from "./resource-cache"

export interface ChunkTaskOptions {
  txId: string
  ownerAddress: string
  totalChunks: number
  gateways: readonly string[]
  onChunkUpload?: (chunkIndex: number) => Promise<void>
  onChunkDownload?: (chunkIndex: number) => Promise<void>
  onProgress?: (completed: number, total: number) => void
  onError?: (chunkIndex: number, error: Error) => void
}

export class ChunkedTaskManager {
  progress: ChunkedResourceProgress
  gateways: readonly string[]
  constructor(progress: ChunkedResourceProgress, gateways: readonly string[]) {
    this.progress = progress
    this.gateways = gateways
  }

  async updateProgress() {
    this.progress.lastUpdated = Date.now()
    await upsertChunkedResourceProgress(this.progress)
  }

  async markChunkCompleted(chunkIndex: number) {
    if (!this.progress.completedChunks.includes(chunkIndex)) {
      this.progress.completedChunks.push(chunkIndex)
      await this.updateProgress()
    }
  }

  async markChunkFailed(chunkIndex: number) {
    if (!this.progress.failedChunks.includes(chunkIndex)) {
      this.progress.failedChunks.push(chunkIndex)
      await this.updateProgress()
    }
  }

  async switchGateway(nextGateway: string) {
    this.progress.lastGateway = nextGateway
    if (!this.progress.gatewaysTried.includes(nextGateway)) {
      this.progress.gatewaysTried.push(nextGateway)
    }
    await this.updateProgress()
  }

  async resumeIncompleteTasks() {
    const incomplete = await getIncompleteChunkedResourceProgress()
    // 可根据 incomplete 任务列表恢复上传/下载
    return incomplete
  }
}

export async function createChunkedTaskManager(
  options: ChunkTaskOptions,
): Promise<ChunkedTaskManager> {
  const progress: ChunkedResourceProgress = {
    txId: options.txId,
    ownerAddress: options.ownerAddress,
    totalChunks: options.totalChunks,
    completedChunks: [],
    failedChunks: [],
    gatewaysTried: [],
    lastGateway: null,
    lastUpdated: Date.now(),
  }
  await upsertChunkedResourceProgress(progress)
  return new ChunkedTaskManager(progress, options.gateways)
}
