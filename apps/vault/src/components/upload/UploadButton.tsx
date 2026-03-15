import { useTranslation } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, Lock } from "lucide-react"

interface UploadButtonProps {
  uploading: boolean
  file: File | null
  canUpload: boolean
  encryptUpload: boolean
  onClick: () => void
}

export function UploadButton({
  uploading,
  file,
  canUpload,
  encryptUpload,
  onClick,
}: UploadButtonProps) {
  const { t } = useTranslation()

  return (
    <Button
      className="touch-target group bg-gradient-primary text-primary-foreground h-14 w-full rounded-xl px-4 text-base font-bold shadow-[0_14px_28px_-20px_hsl(var(--primary)/0.58)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-20px_hsl(var(--primary)/0.5)] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
      onClick={onClick}
      disabled={uploading || !file || !canUpload}
      aria-busy={uploading}
    >
      {uploading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("upload.uploading")}
        </>
      ) : !file ? (
        <>
          <Upload className="mr-2 h-5 w-5" />
          {t("upload.selectFileFirst")}
        </>
      ) : !canUpload ? (
        <>
          <Lock className="mr-2 h-5 w-5" />
          {t("upload.unlockOrSelectAccount")}
        </>
      ) : (
        <>
          <Upload className="mr-2 h-5 w-5" />
          {encryptUpload
            ? t("upload.arweaveSubmit")
            : t("upload.arweaveSubmitNoEncrypt")}
        </>
      )}
    </Button>
  )
}
