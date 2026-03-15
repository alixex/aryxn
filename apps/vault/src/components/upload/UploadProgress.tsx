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

  return (
    <div className="border-border bg-card rounded-lg border p-3 sm:p-4">
      <div className="mb-2 flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-foreground wrap-break-word font-medium">
          {progress.currentFile || t("upload.uploading") + "…"}
        </span>
        {progress.current !== undefined && progress.total !== undefined ? (
          <span className="text-muted-foreground text-xs sm:text-sm">
            {progress.current} / {progress.total}
          </span>
        ) : progress.stage ? (
          <span className="text-muted-foreground text-xs sm:text-sm">
            {progress.stage}
          </span>
        ) : null}
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary relative h-full overflow-hidden transition-all duration-500 ease-out"
          style={{
            width: `${
              progress.progress !== undefined
                ? progress.progress
                : progress.current !== undefined && progress.total !== undefined
                  ? (progress.current / progress.total) * 100
                  : 0
            }%`,
          }}
        >
          <div className="animate-shimmer absolute inset-0" />
        </div>
      </div>
      {progress.stage && (
        <div className="text-muted-foreground mt-2 break-words text-xs">
          {progress.stage}
          {progress.progress !== undefined &&
            ` - ${Math.round(progress.progress)}%`}
        </div>
      )}
    </div>
  )
}
