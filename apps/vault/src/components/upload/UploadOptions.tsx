import { useTranslation } from "@/i18n/config"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ShieldCheck, Zap } from "lucide-react"
import { shouldCompressFile } from "@/lib/utils"

interface UploadOptionsProps {
  encryptUpload: boolean
  compressUpload: boolean
  storageTier: "Permanent" | "Term"
  file: File | null
  files?: File[]
  isUnlocked: boolean
  onEncryptChange: (checked: boolean) => void
  onCompressChange: (checked: boolean) => void
  onStorageTierChange: (tier: "Permanent" | "Term") => void
  disableTermStorage?: boolean
}

export function UploadOptions({
  encryptUpload,
  compressUpload,
  storageTier,
  file,
  files = [],
  isUnlocked,
  onEncryptChange,
  onCompressChange,
  onStorageTierChange,
  disableTermStorage,
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
            ? "border-ring bg-card/85"
            : "border-border bg-[hsl(var(--background)/0.72)] hover:border-ring"
        }`}
      >
        <div className="mt-0.5">
          <Checkbox
            id="encrypt-ar"
            checked={encryptUpload}
            onCheckedChange={onEncryptChange}
            disabled={!isUnlocked}
            className="border-primary/40 bg-transparent data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
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
            ? "border-ring bg-card/85"
            : "border-border bg-[hsl(var(--background)/0.72)] hover:border-ring"
        }`}
      >
        <div className="mt-0.5">
          <Checkbox
            id="compress-ar"
            checked={compressUpload}
            onCheckedChange={onCompressChange}
            disabled={!canCompress}
            className="border-primary/40 bg-transparent data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
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
              <span className="ml-1 rounded-full bg-[hsl(165_48%_92%)] px-2 py-0.5 text-xs font-semibold text-[hsl(165_65%_28%)]">
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

      {/* Storage Tier Options */}
      <div
        className={`group flex items-start gap-4 rounded-xl border p-4 transition-all ${
          storageTier === "Term"
            ? "border-ring bg-card/85"
            : "border-border bg-[hsl(var(--background)/0.72)] hover:border-ring"
        }`}
      >
        <div className="mt-0.5">
          <Checkbox
            id="storage-tier-term"
            checked={storageTier === "Term"}
            onCheckedChange={(checked) =>
              onStorageTierChange(checked ? "Term" : "Permanent")
            }
            disabled={disableTermStorage}
            className="border-primary/40 bg-transparent data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
        </div>
        <div className="flex-1">
          <Label
            htmlFor="storage-tier-term"
            className="text-foreground flex cursor-pointer items-center gap-2 text-sm font-semibold"
          >
            {t("upload.enableTermStorage", "Use Term Storage")}
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase">
              {t("common.cheaper", "Cheaper")}
            </span>
          </Label>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {t(
              "upload.termStorageDesc",
              "Store files temporarily instead of permanently. Ideal for non-critical files and significantly reduces Irys L1 costs.",
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
