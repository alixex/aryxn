import { useTranslation } from "@/i18n/config"

interface UploadProgressProps {
  progress: {
    currentFile?: string
    current?: number
    total?: number
    stage?: string
    progress?: number
  }
}

export function UploadProgress({ progress }: UploadProgressProps) {
  const { t } = useTranslation()

  if (!progress) return null

  const rawPercent =
    progress.progress !== undefined
      ? progress.progress
      : progress.current !== undefined && progress.total !== undefined
        ? (progress.current / progress.total) * 100
        : 0

  const normalizedPercent = Math.max(0, Math.min(100, rawPercent))
  const primaryLabel =
    progress.currentFile || progress.stage || t("upload.uploading")

  return (
    <div className="border-border bg-card rounded-lg border p-3 sm:p-4">
      <div className="mb-2 flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-foreground font-medium wrap-break-word">
          {primaryLabel}
        </span>
        {progress.current !== undefined && progress.total !== undefined ? (
          <span className="text-muted-foreground text-xs sm:text-sm">
            {progress.current} / {progress.total}
          </span>
        ) : null}
      </div>
      <div
        className="bg-muted h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(normalizedPercent)}
      >
        <div
          className="bg-primary relative h-full overflow-hidden transition-all duration-500 ease-out"
          style={{
            width: `${normalizedPercent}%`,
          }}
        >
          <div className="animate-shimmer absolute inset-0" />
        </div>
      </div>
      {progress.currentFile && progress.stage && (
        <div className="text-muted-foreground mt-2 text-xs wrap-break-word">
          {progress.stage}
          {progress.progress !== undefined &&
            ` - ${Math.round(normalizedPercent)}%`}
        </div>
      )}
    </div>
  )
}
