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
      className="group relative h-14 w-full overflow-hidden rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 text-base font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-lg"
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
