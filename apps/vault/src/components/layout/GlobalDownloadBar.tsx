import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, X } from "lucide-react"
import { isTaskActive, useDownloadTaskStore } from "@/lib/store/download-task"
import { cn } from "@/lib/utils"

function formatSpeed(speedBps: number): string {
  if (speedBps >= 1024 * 1024) {
    return `${(speedBps / 1024 / 1024).toFixed(2)} MB/s`
  }
  if (speedBps >= 1024) {
    return `${(speedBps / 1024).toFixed(1)} KB/s`
  }
  return `${speedBps} B/s`
}

export function GlobalDownloadBar({
  topOffsetClassName = "top-16",
  compact = false,
}: {
  topOffsetClassName?: string
  compact?: boolean
}) {
  const activeTask = useDownloadTaskStore((s) => s.activeTask)
  const clearTask = useDownloadTaskStore((s) => s.clearTask)
  const cancelActiveTask = useDownloadTaskStore((s) => s.cancelActiveTask)

  useEffect(() => {
    if (!activeTask) {
      return
    }

    if (
      activeTask.status !== "completed" &&
      activeTask.status !== "failed" &&
      activeTask.status !== "cancelled"
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      clearTask()
    }, 2200)

    return () => window.clearTimeout(timer)
  }, [activeTask, clearTask])

  if (!activeTask) {
    return null
  }

  const percent =
    activeTask.total && activeTask.total > 0
      ? Math.min(100, (activeTask.loaded / activeTask.total) * 100)
      : null

  const statusText =
    activeTask.status === "completed"
      ? "Completed"
      : activeTask.status === "failed"
        ? "Failed"
        : activeTask.status === "cancelled"
          ? "Cancelled"
          : activeTask.message || "Downloading"

  return (
    <div
      className={cn(
        "border-border/80 bg-card/95 fixed z-30 rounded-xl border p-3 shadow-lg backdrop-blur-lg",
        topOffsetClassName,
        compact
          ? "right-3 left-3 sm:right-auto sm:left-1/2 sm:w-[min(92vw,540px)] sm:-translate-x-1/2"
          : "right-3 left-3 sm:right-4 sm:left-4 lg:right-8 lg:left-8",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
            {isTaskActive(activeTask.status) ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="truncate" title={activeTask.fileName}>
              {activeTask.fileName}
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            {statusText}
            {isTaskActive(activeTask.status)
              ? ` · ${formatSpeed(activeTask.speedBps)}`
              : ""}
          </p>
        </div>

        {isTaskActive(activeTask.status) ? (
          <Button
            variant="outline"
            size="icon"
            onClick={cancelActiveTask}
            className="h-8 w-8"
            title="Cancel download"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="bg-border/70 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-150"
          style={{ width: `${percent ?? 100}%` }}
        />
      </div>

      <p className="text-muted-foreground mt-1 text-[11px]">
        {activeTask.total && activeTask.total > 0
          ? `${percent?.toFixed(1)}% (${activeTask.loaded.toLocaleString()}/${activeTask.total.toLocaleString()} bytes)`
          : `${activeTask.loaded.toLocaleString()} bytes`}
      </p>
    </div>
  )
}
