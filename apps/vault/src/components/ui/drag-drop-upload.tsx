import * as React from "react"
import { Upload, File, X } from "lucide-react"
import { cn, formatFileSize } from "@/lib/utils"
import { useTranslation } from "@/i18n/config"
import { toast } from "sonner"

interface DragDropUploadProps {
  onFileSelect: (file: File | null) => void
  onFilesSelect?: (files: File[]) => void
  selectedFile: File | null
  selectedFiles?: File[]
  disabled?: boolean
  accept?: string
  multiple?: boolean
  className?: string
}

export function DragDropUpload({
  onFileSelect,
  onFilesSelect,
  selectedFile,
  selectedFiles = [],
  disabled = false,
  accept,
  multiple = false,
  className,
}: DragDropUploadProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dropZoneRef = React.useRef<HTMLDivElement>(null)

  const handleFile = (file: File) => {
    if (disabled) return
    // 检查是否与已选择的文件重复
    if (selectedFile) {
      if (
        selectedFile.name === file.name &&
        selectedFile.size === file.size &&
        selectedFile.lastModified === file.lastModified
      ) {
        toast.warning(t("upload.duplicateFile"), {
          description: t("upload.duplicateFileDesc", {
            name: file.name,
          }),
        })
        return
      }
    }
    onFileSelect(file)
  }

  // 检查文件是否重复（通过文件名、大小和最后修改时间）
  const isFileDuplicate = (file: File, existingFiles: File[]): boolean => {
    return existingFiles.some(
      (existing) =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified,
    )
  }

  const handleFiles = (files: File[]) => {
    if (disabled || files.length === 0) return
    if (onFilesSelect) {
      // 增量添加：将新文件追加到现有列表
      const duplicateFiles: File[] = []
      const newFiles = files.filter((f) => {
        if (isFileDuplicate(f, selectedFiles)) {
          duplicateFiles.push(f)
          return false
        }
        return true
      })

      // 显示重复文件提示
      if (duplicateFiles.length > 0) {
        if (duplicateFiles.length === 1) {
          toast.warning(t("upload.duplicateFile"), {
            description: t("upload.duplicateFileDesc", {
              name: duplicateFiles[0].name,
            }),
          })
        } else {
          const names = duplicateFiles
            .slice(0, 3)
            .map((f) => f.name)
            .join(", ")
          const moreText =
            duplicateFiles.length > 3
              ? t("upload.duplicateFilesMore", {
                  count: duplicateFiles.length - 3,
                })
              : ""
          toast.warning(
            t("upload.duplicateFiles", { count: duplicateFiles.length }),
            {
              description: t("upload.duplicateFilesDesc", {
                names: names + moreText,
              }),
            },
          )
        }
      }

      if (newFiles.length > 0) {
        onFilesSelect([...selectedFiles, ...newFiles])
      }
    } else if (files.length > 0) {
      // 如果没有提供 onFilesSelect，只选择第一个文件（向后兼容）
      onFileSelect(files[0])
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set isDragging to false if we're leaving the drop zone itself
    if (
      dropZoneRef.current &&
      !dropZoneRef.current.contains(e.relatedTarget as Node)
    ) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      if (multiple) {
        // 拖拽时也是增量添加
        handleFiles(files)
      } else {
        handleFile(files[0])
      }
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      if (files.length > 0) {
        if (multiple) {
          handleFiles(files)
        } else {
          handleFile(files[0])
        }
      }
    }
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const handleRemove = (e: React.MouseEvent, fileToRemove?: File) => {
    e.stopPropagation()
    // 注意：不清空 input.value，保持文件选择器状态，支持继续添加文件
    if (multiple && onFilesSelect && fileToRemove) {
      const newFiles = selectedFiles.filter((f) => f !== fileToRemove)
      onFilesSelect(newFiles)
      if (newFiles.length === 0) {
        onFileSelect(null)
        // 只有当所有文件都删除时才清空 input
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    } else {
      onFileSelect(null)
      if (onFilesSelect) {
        onFilesSelect([])
      }
      // 清空 input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const displayFiles = multiple
    ? selectedFiles
    : selectedFile
      ? [selectedFile]
      : []

  return (
    <div
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={cn(
        "relative flex min-h-60 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-300 sm:min-h-70",
        isDragging
          ? "border-ring bg-card scale-[1.01] shadow-sm"
          : "border-border bg-background hover:border-ring hover:bg-accent hover:shadow-sm",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        onChange={handleFileInputChange}
        disabled={disabled}
        accept={accept}
        multiple={multiple}
      />

      {displayFiles.length > 0 ? (
        <div className="flex w-full flex-col gap-4 p-6">
          <div className="max-h-100 overflow-y-auto">
            <div
              className={
                displayFiles.length === 1
                  ? // 单个文件：居中显示，最大宽度限制
                    "flex justify-center"
                  : // 多个文件：网格布局
                    "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {displayFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={`group animate-scale-in border-border bg-card hover:border-ring relative rounded-xl border-2 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                    displayFiles.length === 1
                      ? "w-full max-w-md" // 单个文件时限制最大宽度，居中显示
                      : "w-full" // 多个文件时使用网格，宽度自动
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="bg-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                          <File className="text-foreground h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-foreground truncate text-sm font-semibold">
                            {file.name}
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleRemove(e, file)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 rounded-md p-1.5 opacity-0 transition-all group-hover:opacity-100"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {multiple && (
            <p className="text-muted-foreground text-center text-xs">
              {t("upload.dragDropHint")} {displayFiles.length}{" "}
              {t("upload.filesSelected")}
            </p>
          )}
          {!multiple && (
            <p className="text-muted-foreground text-center text-xs">
              {t("upload.dragDropHint")}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 p-8 text-center sm:gap-6">
          <div className="bg-secondary flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24">
            <Upload className="text-foreground h-10 w-10 sm:h-12 sm:w-12" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-base font-semibold sm:text-lg">
              {isDragging ? t("upload.dropFile") : t("upload.dragDropTitle")}
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {t("upload.dragDropSubtitle")}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
