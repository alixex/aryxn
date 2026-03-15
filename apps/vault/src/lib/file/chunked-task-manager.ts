import type { ChunkedResourceProgress } from "./resource-cache"
import { upsertChunkedResourceProgress, getIncompleteChunkedResourceProgress } from "./resource-cache"

export interface ChunkTaskOptions {
  txId: string
  ownerAddress: string
  totalChunks: number
  gateways: string[]
  onChunkUpload?: (chunkIndex: number) => Promise<void>
  onChunkDownload?: (chunkIndex: number) => Promise<void>
  onProgress?: (completed: number, total: number) => void
  onError?: (chunkIndex: number, error: Error) => void
}

export class ChunkedTaskManager {
  progress: ChunkedResourceProgress
  gateways: string[]
  constructor(progress: ChunkedResourceProgress, gateways: string[]) {
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

export async function createChunkedTaskManager(options: ChunkTaskOptions): Promise<ChunkedTaskManager> {
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
