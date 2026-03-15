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
      className="group bg-gradient-primary h-14 w-full rounded-xl text-base font-bold text-primary-foreground shadow-[0_14px_30px_-18px_hsl(var(--primary)/0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-16px_hsl(var(--primary)/0.8)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={uploading || !file || !canUpload}
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
          <Upload className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
          {encryptUpload
            ? t("upload.arweaveSubmit")
            : t("upload.arweaveSubmitNoEncrypt")}
        </>
      )}
    </Button>
  )
}
