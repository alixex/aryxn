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

  const isCheckboxTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('[role="checkbox"],input,button,label'))
  }

  // 检查是否有文件适合压缩（单个文件或多文件模式）
  const displayFiles = files.length > 0 ? files : file ? [file] : []
  const hasCompressibleFile = displayFiles.some((f) => shouldCompressFile(f))
  const canCompress = displayFiles.length > 0

  return (
    <div className="space-y-3">
      <div
        className={`group flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all duration-200 ${
          encryptUpload
            ? "border-primary/45 bg-[hsl(var(--card)/0.88)]"
            : "hover:border-primary/35 border-[hsl(var(--border)/0.85)] bg-[hsl(var(--background)/0.76)]"
        }`}
        onClick={(event) => {
          if (isCheckboxTarget(event.target) || !isUnlocked) return
          onEncryptChange(!encryptUpload)
        }}
      >
        <div className="mt-0.5">
          <Checkbox
            id="encrypt-ar"
            checked={encryptUpload}
            onCheckedChange={onEncryptChange}
            disabled={!isUnlocked}
            className="border-primary/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground bg-transparent"
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
        className={`group flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all duration-200 ${
          compressUpload && hasCompressibleFile
            ? "border-primary/45 bg-[hsl(var(--card)/0.88)]"
            : "hover:border-primary/35 border-[hsl(var(--border)/0.85)] bg-[hsl(var(--background)/0.76)]"
        }`}
        onClick={(event) => {
          if (isCheckboxTarget(event.target) || !canCompress) return
          onCompressChange(!compressUpload)
        }}
      >
        <div className="mt-0.5">
          <Checkbox
            id="compress-ar"
            checked={compressUpload}
            onCheckedChange={onCompressChange}
            disabled={!canCompress}
            className="border-primary/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground bg-transparent"
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
              <span className="bg-primary/10 text-primary ring-primary/20 ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1">
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
