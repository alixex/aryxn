import { File, FileText, Image, Video, Music, Archive } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface FilePreviewProps {
  file: File
  className?: string
}

export function FilePreview({ file, className }: FilePreviewProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-8 w-8" />
    if (type.startsWith("video/")) return <Video className="h-8 w-8" />
    if (type.startsWith("audio/")) return <Music className="h-8 w-8" />
    if (
      type.includes("zip") ||
      type.includes("rar") ||
      type.includes("tar") ||
      type.includes("gz")
    )
      return <Archive className="h-8 w-8" />
    if (type.includes("text")) return <FileText className="h-8 w-8" />
    return <File className="h-8 w-8" />
  }

  const isImage = file.type.startsWith("image/")
  const imageUrl = isImage ? URL.createObjectURL(file) : null

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* File Icon or Thumbnail */}
          <div className="bg-gradient-primary glow-purple flex-shrink-0 rounded-lg p-3 text-white shadow-lg">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={file.name}
                className="h-12 w-12 rounded object-cover"
                onLoad={() => URL.revokeObjectURL(imageUrl)}
              />
            ) : (
              getFileIcon(file.type)
            )}
          </div>

          {/* File Info */}
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-semibold">
              {file.name}
            </p>
            <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>{formatBytes(file.size)}</span>
              <span>{file.type || "Unknown type"}</span>
              <span>
                {new Date(file.lastModified).toLocaleDateString("zh-CN")}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
