import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { FileUploadSection } from "./FileUploadSection"

export interface FileSelection {
  file: File | null
  files: File[]
  multipleMode: boolean
}

interface FileSelectionCardProps {
  disabled?: boolean
  onChange: (selection: FileSelection) => void
}

export function FileSelectionCard({
  disabled = false,
  onChange,
}: FileSelectionCardProps) {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [multipleMode, setMultipleMode] = useState(false)

  // Notify parent whenever selection changes
  useEffect(() => {
    onChange({ file, files, multipleMode })
  }, [file, files, multipleMode, onChange])

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile)
      setFiles([])
      setMultipleMode(false)
    } else {
      setFile(null)
      setFiles([])
    }
  }

  const handleFilesSelect = (selectedFiles: File[]) => {
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles)
      setFile(selectedFiles[0])
      setMultipleMode(true)
    } else {
      setFiles([])
      setFile(null)
      setMultipleMode(false)
    }
  }

  return (
    <Card className="border-border overflow-hidden rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl">
      <CardHeader className="border-border border-b pb-4 sm:pb-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <div className="bg-secondary flex h-8 w-8 items-center justify-center rounded-lg">
            <FileText className="text-foreground h-4 w-4" />
          </div>
          {t("upload.selectFiles")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <FileUploadSection
          file={file}
          files={files}
          onFileSelect={handleFileSelect}
          onFilesSelect={handleFilesSelect}
          disabled={disabled}
          multiple={true}
        />
      </CardContent>
    </Card>
  )
}
