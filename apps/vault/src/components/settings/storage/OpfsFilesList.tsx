import { useTranslation } from "@/i18n/config"
import { Database } from "lucide-react"

export default function OpfsFilesList({
  filesWithSize,
  files,
  formatBytes,
}: {
  filesWithSize: Array<{ name: string; size: number; path: string }>
  files: string[]
  formatBytes: (bytes: number | null) => string
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="text-foreground font-semibold">
          {t("settings.opfsFiles", "OPFS Files")}
        </div>
        {filesWithSize.length > 0 && (
          <span className="bg-muted text-muted-foreground ring-border rounded-md px-2 py-0.5 text-xs font-semibold ring-1">
            {t("settings.totalSize", "Total")}:{" "}
            {formatBytes(filesWithSize.reduce((acc, f) => acc + f.size, 0))}
          </span>
        )}
      </div>
      {files.length === 0 ? (
        <p className="text-muted-foreground">
          {t("settings.noOpfsFiles", "No OPFS files found")}
        </p>
      ) : (
        <div className="space-y-2 pt-1">
          {filesWithSize.length > 0 ? (
            filesWithSize.map((file) => (
              <div
                key={file.path}
                className="bg-card/60 border-border/60 text-muted-foreground flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-foreground/70" />
                  <span className="font-mono text-xs font-medium">
                    {file.name}
                  </span>
                </div>
                <span className="bg-muted/70 text-foreground/80 ring-border/70 rounded-full px-2 py-0.5 text-xs font-semibold ring-1">
                  {formatBytes(file.size)}
                </span>
              </div>
            ))
          ) : (
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              {files.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
