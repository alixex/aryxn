import { useTranslation } from "@/i18n/config"
import { Label } from "@/components/ui/label"
import { DragDropUpload } from "@/components/ui/drag-drop-upload"
import { Lock } from "lucide-react"

interface FileUploadSectionProps {
  file: File | null
  files?: File[]
  onFileSelect: (file: File | null) => void
  onFilesSelect?: (files: File[]) => void
  disabled: boolean
  multiple?: boolean
}

export function FileUploadSection({
  file,
  files = [],
  onFileSelect,
  onFilesSelect,
  disabled,
  multiple = false,
}: FileUploadSectionProps) {
  const { t } = useTranslation()

  return (
    <div className="grid w-full items-center gap-2 sm:gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-foreground text-sm font-bold">
          {multiple ? t("upload.chooseFiles") : t("upload.chooseFile")}
        </Label>
        {disabled && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <Lock className="h-3 w-3" />
            {t("upload.unlockRequired")}
          </span>
        )}
      </div>
      <DragDropUpload
        onFileSelect={onFileSelect}
        onFilesSelect={onFilesSelect}
        selectedFile={file}
        selectedFiles={files}
        disabled={disabled}
        multiple={multiple}
      />
      {disabled && (
        <p className="mt-1 text-xs text-amber-600">
          {t("upload.unlockToSelectFile")}
        </p>
      )}
    </div>
  )
}
