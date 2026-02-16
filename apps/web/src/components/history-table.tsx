import type { UploadRecord } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, Loader2, Shield } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/i18n/config"
import {
  formatFileSize,
  formatDateTime,
  getFileTypeDisplay,
} from "./history-table/utils"
import { handleFileDownload } from "./history-table/download-handler"

export function HistoryTable({
  records,
  masterKey,
  activeAddress,
}: {
  records: UploadRecord[]
  masterKey: Uint8Array | null
  activeAddress: string | null
}) {
  const { t } = useTranslation()
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (
    record: UploadRecord,
    decrypt: boolean = true,
  ) => {
    if (record.ownerAddress !== activeAddress) {
      toast.error(t("history.errorOwner"))
      return
    }

    // 如果请求解密但未解锁，提示用户
    if (decrypt && record.encryptionAlgo !== "none" && !masterKey) {
      toast.error(t("history.errorLocked"))
      return
    }

    setDownloading(record.txId)
    try {
      await handleFileDownload(record, masterKey, decrypt, t)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)

      // 检查是否是分块下载相关的错误
      if (
        errorMessage.includes("chunk") ||
        errorMessage.includes("seeded") ||
        errorMessage.includes("Failed to fetch")
      ) {
        const hintMessage = t("history.chunkErrorHint")
        toast.error(
          t("history.failedDownloadChunk", { message: hintMessage }),
          {
            duration: 8000,
            action: {
              label: "View Transaction",
              onClick: () => {
                window.open(`https://arweave.net/${record.txId}`, "_blank")
              },
            },
          },
        )
      } else {
        toast.error(t("history.failedDownload", { message: errorMessage }))
      }
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-border bg-secondary/50 text-muted-foreground border-b text-[10px] font-bold tracking-wider uppercase sm:text-xs">
            <tr>
              <th className="w-[200px] px-4 py-3 sm:px-6">
                {t("history.fileName")}
              </th>
              <th className="hidden w-[80px] px-4 py-3 sm:px-6 lg:table-cell">
                {t("history.fileType")}
              </th>
              <th className="hidden w-[80px] px-4 py-3 sm:px-6 xl:table-cell">
                {t("history.fileSize")}
              </th>
              <th className="hidden w-[140px] px-4 py-3 sm:px-6 lg:table-cell">
                {t("history.time")}
              </th>
              <th className="hidden w-[140px] px-4 py-3 sm:px-6 xl:table-cell">
                {t("history.txId")}
              </th>
              <th className="hidden w-[100px] px-4 py-3 sm:table-cell sm:px-6">
                {t("history.protocol")}
              </th>
              <th className="w-[100px] px-4 py-3 sm:px-6">
                {t("history.security")}
              </th>
              <th className="w-[100px] px-4 py-3 text-right sm:px-6">
                {t("history.action")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y text-xs sm:text-sm">
            {records.map((r) => (
              <tr
                key={r.txId}
                className="group hover:bg-accent transition-all duration-200 hover:shadow-sm"
              >
                {/* 文件名 */}
                <td
                  className="text-foreground truncate px-4 py-4 font-bold sm:px-6"
                  title={r.fileName}
                >
                  <span className="block truncate">{r.fileName}</span>
                </td>
                {/* 文件类型 */}
                <td
                  className="text-muted-foreground hidden truncate px-4 py-4 sm:px-6 lg:table-cell"
                  title={r.mimeType || "-"}
                >
                  <span className="block truncate text-xs font-medium">
                    {getFileTypeDisplay(r.mimeType)}
                  </span>
                </td>
                {/* 文件大小 */}
                <td
                  className="text-muted-foreground hidden truncate px-4 py-4 sm:px-6 xl:table-cell"
                  title={r.fileSize ? formatFileSize(r.fileSize) : "-"}
                >
                  <span className="block truncate text-xs font-medium">
                    {formatFileSize(r.fileSize)}
                  </span>
                </td>
                {/* 时间 */}
                <td
                  className="text-muted-foreground hidden truncate px-4 py-4 sm:px-6 lg:table-cell"
                  title={formatDateTime(r.createdAt)}
                >
                  <span className="block truncate text-xs font-medium">
                    {formatDateTime(r.createdAt)}
                  </span>
                </td>
                {/* 交易 ID */}
                <td className="hidden truncate px-4 py-4 sm:px-6 xl:table-cell">
                  <a
                    href={`https://arweave.net/${r.txId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group/tx text-foreground hover:text-primary block truncate font-mono text-xs hover:underline"
                    title={r.txId}
                  >
                    <span className="inline-block truncate">
                      {r.txId.slice(0, 8)}...{r.txId.slice(-6)}
                    </span>
                    <ExternalLink className="ml-1 inline h-3 w-3 opacity-0 transition-opacity group-hover/tx:opacity-100" />
                  </a>
                </td>
                {/* 协议 */}
                <td
                  className="hidden truncate px-4 py-4 sm:table-cell sm:px-6"
                  title="Arweave"
                >
                  <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 uppercase ring-1 ring-orange-200 ring-inset">
                    Arweave
                  </span>
                </td>
                {/* 安全性 */}
                <td className="truncate px-4 py-4 sm:px-6">
                  {r.encryptionAlgo !== "none" ? (
                    <div
                      className="flex items-center gap-1.5 text-green-600"
                      title={t("history.encrypted")}
                    >
                      <Shield className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-[10px] font-bold uppercase">
                        {t("history.encrypted")}
                      </span>
                    </div>
                  ) : (
                    <span
                      className="text-muted-foreground block truncate text-[10px] font-bold uppercase"
                      title={t("history.public")}
                    >
                      {t("history.public")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right sm:px-6">
                  <div className="flex items-center justify-end gap-1 sm:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="text-muted-foreground hover:bg-accent hover:text-foreground h-8 w-8 transition-all duration-200 hover:scale-110 active:scale-95 sm:h-9 sm:w-9"
                    >
                      <a
                        href={`https://arweave.net/${r.txId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    {r.encryptionAlgo !== "none" && !masterKey ? (
                      // 加密文件但未解锁：显示两个按钮 - 下载加密版本和解密下载（禁用）
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDownload(r, false)}
                          disabled={!!downloading}
                          className="h-8 w-8 transition-all duration-200 hover:scale-110 active:scale-95 sm:h-9 sm:w-9"
                          title={t(
                            "history.downloadEncryptedTooltip",
                            "Download encrypted file",
                          )}
                        >
                          {downloading === r.txId ? (
                            <Loader2 className="text-foreground h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={true}
                          onClick={() => {
                            toast.info(
                              t(
                                "history.unlockToDecrypt",
                                "Please unlock your account to download decrypted files. Go to Account page to unlock.",
                              ),
                              {
                                action: {
                                  label: t(
                                    "common.goToAccount",
                                    "Go to Account",
                                  ),
                                  onClick: () => {
                                    window.location.href = "/account"
                                  },
                                },
                                duration: 5000,
                              },
                            )
                          }}
                          className="h-8 w-8 cursor-pointer opacity-50 hover:opacity-75 sm:h-9 sm:w-9"
                          title={t(
                            "history.decryptDownloadTooltip",
                            "Unlock account to download decrypted file",
                          )}
                        >
                          <Shield className="text-muted-foreground/30 h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      // 非加密文件或已解锁：显示单个下载按钮（自动解密）
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDownload(r, true)}
                        disabled={!!downloading}
                        className={`h-8 w-8 transition-all duration-200 hover:scale-110 active:scale-95 sm:h-9 sm:w-9 ${
                          downloading === r.txId ? "border-ring bg-accent" : ""
                        }`}
                        title={
                          r.encryptionAlgo !== "none"
                            ? t(
                                "history.downloadDecryptedTooltip",
                                "Download decrypted file",
                              )
                            : t("history.downloadTooltip", "Download file")
                        }
                      >
                        {downloading === r.txId ? (
                          <Loader2 className="text-foreground h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-muted-foreground px-4 py-12 text-center text-sm font-medium italic sm:px-6"
                >
                  {t("history.noRecords")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
