import { create } from "zustand"

export type DownloadTaskStatus =
  | "starting"
  | "downloading"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"

export type DownloadTask = {
  id: string
  txId: string
  fileName: string
  loaded: number
  total: number | null
  speedBps: number
  status: DownloadTaskStatus
  message?: string
  startedAt: number
  updatedAt: number
  controller: AbortController | null
}

type DownloadTaskStore = {
  activeTask: DownloadTask | null
  startTask: (input: {
    txId: string
    fileName: string
    total?: number | null
    controller: AbortController
  }) => DownloadTask
  updateProgress: (loaded: number, total?: number | null) => void
  setStatus: (status: DownloadTaskStatus, message?: string) => void
  finishTask: (
    status: "completed" | "failed" | "cancelled",
    message?: string,
  ) => void
  cancelActiveTask: () => void
  clearTask: () => void
}

function createTaskId(txId: string): string {
  return `${txId}-${Date.now()}`
}

export const useDownloadTaskStore = create<DownloadTaskStore>((set, get) => ({
  activeTask: null,

  startTask: ({ txId, fileName, total, controller }) => {
    const now = Date.now()
    const task: DownloadTask = {
      id: createTaskId(txId),
      txId,
      fileName,
      loaded: 0,
      total: total ?? null,
      speedBps: 0,
      status: "starting",
      startedAt: now,
      updatedAt: now,
      controller,
    }

    set({ activeTask: task })
    return task
  },

  updateProgress: (loaded, total) => {
    const prev = get().activeTask
    if (!prev) {
      return
    }

    const now = Date.now()
    const deltaBytes = Math.max(0, loaded - prev.loaded)
    const deltaMs = Math.max(1, now - prev.updatedAt)
    const speedBps = Math.round((deltaBytes / deltaMs) * 1000)

    set({
      activeTask: {
        ...prev,
        loaded,
        total: total ?? prev.total,
        speedBps,
        status: "downloading",
        updatedAt: now,
      },
    })
  },

  setStatus: (status, message) => {
    const prev = get().activeTask
    if (!prev) {
      return
    }
    set({
      activeTask: {
        ...prev,
        status,
        message,
        updatedAt: Date.now(),
      },
    })
  },

  finishTask: (status, message) => {
    const prev = get().activeTask
    if (!prev) {
      return
    }
    set({
      activeTask: {
        ...prev,
        status,
        message,
        controller: null,
        updatedAt: Date.now(),
      },
    })
  },

  cancelActiveTask: () => {
    const prev = get().activeTask
    if (!prev) {
      return
    }

    prev.controller?.abort()

    set({
      activeTask: {
        ...prev,
        status: "cancelled",
        message: "Download cancelled",
        controller: null,
        updatedAt: Date.now(),
      },
    })
  },

  clearTask: () => set({ activeTask: null }),
}))

export function isTaskActive(status: DownloadTaskStatus): boolean {
  return (
    status === "starting" || status === "downloading" || status === "processing"
  )
}
