import { useTranslation } from "@/i18n/config"

export default function OpfsFilesList({
  filesWithSize,
  files,
}: {
  filesWithSize: Array<{ name: string; size: number; path: string }>
  files: string[]
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="text-foreground font-semibold">
          {t("settings.opfsFiles", "OPFS Files")}
        </div>
        {filesWithSize.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {t("settings.totalSize", "Total")}:{" "}
            {filesWithSize.reduce((acc, f) => acc + f.size, 0)}
          </span>
        )}
      </div>
      {files.length === 0 ? (
        <p className="text-muted-foreground">
          {t("settings.noOpfsFiles", "No OPFS files found")}
        </p>
      ) : (
        <div className="space-y-1">
          {filesWithSize.length > 0 ? (
            filesWithSize.map((file) => (
              <div
                key={file.path}
                className="bg-card text-muted-foreground flex items-center justify-between rounded-md px-2 py-1"
              >
                <span className="font-mono text-xs">{file.name}</span>
                <span className="text-xs">{file.size}</span>
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
