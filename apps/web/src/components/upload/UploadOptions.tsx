import { useTranslation } from "@/i18n/config"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ShieldCheck, Zap } from "lucide-react"
import { shouldCompressFile } from "@/lib/utils"

interface UploadOptionsProps {
  encryptUpload: boolean
  compressUpload: boolean
  file: File | null
  files?: File[]
  isUnlocked: boolean
  onEncryptChange: (checked: boolean) => void
  onCompressChange: (checked: boolean) => void
}

export function UploadOptions({
  encryptUpload,
  compressUpload,
  file,
  files = [],
  isUnlocked,
  onEncryptChange,
  onCompressChange,
}: UploadOptionsProps) {
  const { t } = useTranslation()

  // 检查是否有文件适合压缩（单个文件或多文件模式）
  const displayFiles = files.length > 0 ? files : file ? [file] : []
  const hasCompressibleFile = displayFiles.some((f) => shouldCompressFile(f))
  const canCompress = displayFiles.length > 0

  return (
    <div className="space-y-3">
      <div
        className={`group flex items-start gap-4 rounded-xl border p-4 transition-all ${
          encryptUpload
            ? "border-ring bg-card"
            : "border-border bg-secondary/30 hover:border-ring"
        }`}
      >
        <div className="mt-0.5">
          <Checkbox
            id="encrypt-ar"
            checked={encryptUpload}
            onCheckedChange={onEncryptChange}
            disabled={!isUnlocked}
            className="data-[state=checked]:border-foreground data-[state=checked]:bg-foreground h-5 w-5 border-2"
          />
        </div>
        <div className="flex-1">
          <Label
            htmlFor="encrypt-ar"
            className="text-foreground flex cursor-pointer items-center gap-2 text-sm font-semibold"
          >
            {t("upload.enableEncryption")}
            <ShieldCheck className="text-foreground h-4 w-4" />
          </Label>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {isUnlocked
              ? t("upload.encryptionDesc")
              : t("upload.encryptionRequiresUnlock")}
          </p>
        </div>
      </div>

      <div
        className={`group flex items-start gap-4 rounded-xl border p-4 transition-all ${
          compressUpload && hasCompressibleFile
            ? "border-ring bg-card"
            : "border-border bg-secondary/30 hover:border-ring"
        }`}
      >
        <div className="mt-0.5">
          <Checkbox
            id="compress-ar"
            checked={compressUpload}
            onCheckedChange={onCompressChange}
            disabled={!canCompress}
            className="data-[state=checked]:border-foreground data-[state=checked]:bg-foreground h-5 w-5 border-2"
          />
        </div>
        <div className="flex-1">
          <Label
            htmlFor="compress-ar"
            className="text-foreground flex cursor-pointer items-center gap-2 text-sm font-semibold"
          >
            {t("upload.enableCompression")}
            <Zap className="text-foreground h-4 w-4" />
            {hasCompressibleFile && (
              <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                {t("upload.compressionRecommended")}
              </span>
            )}
          </Label>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {hasCompressibleFile
              ? t("upload.compressionDesc")
              : t("upload.compressionNotRecommended")}
          </p>
        </div>
      </div>
    </div>
  )
}
