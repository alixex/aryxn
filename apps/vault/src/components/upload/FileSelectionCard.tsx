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
    <Card className="glass-premium hover:shadow-primary/5 border-none shadow-2xl transition-all duration-500">
      <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
        <CardTitle className="text-foreground flex items-center gap-3 text-lg font-bold sm:text-xl">
          <div className="rounded-lg bg-cyan-400/20 p-2">
            <FileText className="h-5 w-5 text-cyan-400" />
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
