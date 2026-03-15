import type { UploadRecord } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  MoreHorizontal,
  Shield,
  X,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "@/i18n/config"
import {
  formatFileSize,
  formatDateTime,
  getFileTypeDisplay,
} from "./history-table/utils"
import { handleFileDownload } from "./history-table/download-handler"
import { generateAuthParam } from "@/lib/resource-auth"
import { isTaskActive, useDownloadTaskStore } from "@/lib/store/download-task"

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
  const [openMenuTxId, setOpenMenuTxId] = useState<string | null>(null)
  const activeTask = useDownloadTaskStore((s) => s.activeTask)
  const startTask = useDownloadTaskStore((s) => s.startTask)
  const updateProgress = useDownloadTaskStore((s) => s.updateProgress)
  const setStatus = useDownloadTaskStore((s) => s.setStatus)
  const finishTask = useDownloadTaskStore((s) => s.finishTask)
  const cancelActiveTask = useDownloadTaskStore((s) => s.cancelActiveTask)

  const isAnotherTaskRunning =
    !!activeTask && isTaskActive(activeTask.status) && activeTask.txId !== downloading
  const isAnyTaskRunning = !!activeTask && isTaskActive(activeTask.status)

  const handleDownload = async (
    record: UploadRecord,
    decrypt: boolean = true,
  ) => {
    if (isAnotherTaskRunning) {
      toast.info(
        t(
          "history.singleDownloadActive",
          "A download is already in progress. Please wait or cancel it first.",
        ),
      )
      return
    }

    if (record.ownerAddress !== activeAddress) {
      toast.error(t("history.errorOwner"))
      return
    }

    // 如果请求解密但未解锁，提示用户
    if (decrypt && record.encryptionAlgo !== "none" && !masterKey) {
      toast.error(t("history.errorLocked"))
      return
    }

    const controller = new AbortController()
    const totalSize = typeof record.fileSize === "number" ? record.fileSize : 0
    startTask({
      txId: record.txId,
      fileName: record.fileName,
      total: totalSize > 0 ? totalSize : null,
      controller,
    })

    setDownloading(record.txId)
    try {
      setStatus("downloading", "Downloading")
      await handleFileDownload(record, masterKey, decrypt, t, {
        onProgress: (loaded, total) => {
          updateProgress(loaded, total)
        },
        signal: controller.signal,
      })
      finishTask("completed", "Download completed")
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)

      if (
        (e instanceof DOMException && e.name === "AbortError") ||
        errorMessage.toLowerCase().includes("abort")
      ) {
        finishTask("cancelled", "Download cancelled")
        toast.info(t("history.downloadCancelled", "Download was cancelled."))
        return
      }

      finishTask("failed", errorMessage)

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

  const cancelActiveDownload = () => {
    cancelActiveTask()
  }

  const getProgressPercent = (progress: {
    loaded: number
    total: number | null
  }): number | null => {
    if (!progress.total || progress.total <= 0) {
      return null
    }

    return Math.min(100, (progress.loaded / progress.total) * 100)
  }

  const getResourcePath = (record: UploadRecord): string => {
    const owner = encodeURIComponent(record.ownerAddress)
    const tx = encodeURIComponent(record.txId)
    return `/data/${owner}/${tx}`
  }

  const getDownloadPath = (record: UploadRecord): string => {
    const owner = encodeURIComponent(record.ownerAddress)
    const tx = encodeURIComponent(record.txId)
    return `/download/${owner}/${tx}`
  }

  const getResourceUrl = (record: UploadRecord): string => {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")
    return `${window.location.origin}${basePath}${getResourcePath(record)}`
  }

  const getDownloadUrl = (record: UploadRecord): string => {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")
    return `${window.location.origin}${basePath}${getDownloadPath(record)}`
  }

  const getGatewayUrl = (record: UploadRecord): string => {
    return record.storageType === "irys"
      ? `https://gateway.irys.xyz/${record.txId}`
      : `https://arweave.net/${record.txId}`
  }

  const handleCopyResourceUrl = async (
    record: UploadRecord,
    withAuth = false,
  ) => {
    try {
      let url = getResourceUrl(record)
      if (withAuth && masterKey) {
        const auth = await generateAuthParam(masterKey, record.txId)
        url = `${url}?auth=${auth}`
      }
      await navigator.clipboard.writeText(url)
      toast.success(
        t(
          withAuth
            ? "history.copyPreviewLinkAuthSuccess"
            : "history.copyResourceLinkSuccess",
          withAuth ? "Preview link (with auth) copied" : "Preview link copied",
        ),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(
        t("history.copyResourceLinkFailed", "Failed to copy link"),
        { description: message },
      )
    }
  }

  const handleCopyDownloadUrl = async (
    record: UploadRecord,
    withAuth = false,
  ) => {
    try {
      let url = getDownloadUrl(record)
      if (withAuth && masterKey) {
        const auth = await generateAuthParam(masterKey, record.txId)
        url = `${url}?auth=${auth}`
      }
      await navigator.clipboard.writeText(url)
      toast.success(
        t(
          withAuth
            ? "history.copyDownloadLinkAuthSuccess"
            : "history.copyDownloadLinkSuccess",
          withAuth
            ? "Download link (with auth) copied"
            : "Download link copied",
        ),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(
        t("history.copyDownloadLinkFailed", "Failed to copy download link"),
        { description: message },
      )
    }
  }

  return (
    <div className="border-border/90 bg-card/86 w-full overflow-hidden rounded-xl border">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-200 table-fixed text-left text-sm">
          <thead className="glass-strong border-border/85 bg-card/88 text-muted-foreground border-b text-[10px] font-semibold tracking-wider uppercase backdrop-blur-md sm:text-xs">
            <tr>
              <th className="w-[24%] px-4 py-3 sm:px-6">
                {t("history.fileName")}
              </th>
              <th className="w-[9%] px-4 py-3 sm:px-6">
                {t("history.fileType")}
              </th>
              <th className="w-[8%] px-4 py-3 sm:px-6">
                {t("history.fileSize")}
              </th>
              <th className="w-[12%] px-4 py-3 sm:px-6">{t("history.time")}</th>
              <th className="w-[13%] px-4 py-3 sm:px-6">{t("history.txId")}</th>
              <th className="w-[8%] px-4 py-3 sm:px-6">
                {t("history.protocol")}
              </th>
              <th className="w-[8%] px-4 py-3 sm:px-6">
                {t("history.security")}
              </th>
              <th className="w-[18%] px-4 py-3 text-right sm:px-6">
                {t("history.action")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y text-xs sm:text-sm">
            {records.map((r) => {
              return (
                <tr
                  key={r.txId}
                  className="group transition-colors duration-150 hover:bg-[hsl(var(--accent)/0.55)]"
                >
                      {/* 文件名 */}
                      <td
                        className="text-foreground w-[24%] truncate px-4 py-3.5 font-semibold sm:px-6"
                        title={r.fileName}
                      >
                        <span className="block truncate">{r.fileName}</span>
                      </td>
                      {/* 文件类型 */}
                      <td
                        className="text-muted-foreground w-[9%] truncate px-4 py-3.5 sm:px-6"
                        title={r.mimeType || "-"}
                      >
                        <span className="block truncate text-xs font-medium">
                          {getFileTypeDisplay(r.mimeType)}
                        </span>
                      </td>
                      {/* 文件大小 */}
                      <td
                        className="text-muted-foreground w-[8%] truncate px-4 py-3.5 sm:px-6"
                        title={r.fileSize ? formatFileSize(r.fileSize) : "-"}
                      >
                        <span className="block truncate text-xs font-medium">
                          {formatFileSize(r.fileSize)}
                        </span>
                      </td>
                      {/* 时间 */}
                      <td
                        className="text-muted-foreground w-[12%] truncate px-4 py-3.5 sm:px-6"
                        title={formatDateTime(r.createdAt)}
                      >
                        <span className="block truncate text-xs font-medium">
                          {formatDateTime(r.createdAt)}
                        </span>
                      </td>
                      {/* 存储 ID */}
                      <td className="w-[13%] truncate px-4 py-3.5 sm:px-6">
                        <div>
                          <a
                            href={getResourceUrl(r)}
                            target="_blank"
                            rel="noreferrer"
                            className="group/tx text-primary hover:text-primary/85 block truncate font-mono text-xs font-semibold hover:underline"
                            title={r.txId}
                          >
                            <span className="inline-block truncate">
                              {r.txId.slice(0, 8)}...{r.txId.slice(-6)}
                            </span>
                            <Link2 className="ml-1 inline h-3 w-3 opacity-0 transition-opacity group-hover/tx:opacity-100" />
                          </a>
                        </div>
                      </td>
                      {/* 协议 */}
                      <td
                        className="w-[8%] truncate px-4 py-3.5 sm:px-6"
                        title={r.storageType === "irys" ? "Irys L1" : "Arweave"}
                      >
                        {r.storageType === "irys" ? (
                          <span className="bg-muted text-foreground ring-border inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset">
                            Irys L1
                          </span>
                        ) : (
                          <span className="bg-muted text-foreground ring-border inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset">
                            Arweave
                          </span>
                        )}
                      </td>
                      {/* 安全性 */}
                      <td className="w-[8%] truncate px-4 py-3.5 sm:px-6">
                        {r.encryptionAlgo !== "none" ? (
                          <div
                            className="text-foreground flex items-center gap-1.5"
                            title={t("history.encrypted")}
                          >
                            <Shield className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate text-[10px] font-semibold uppercase">
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
                      <td className="w-[18%] px-4 py-3.5 text-right sm:px-6">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <Popover
                            open={openMenuTxId === r.txId}
                            onOpenChange={(open) => {
                              if (isAnyTaskRunning) {
                                return
                              }
                              setOpenMenuTxId(open ? r.txId : null)
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isAnyTaskRunning}
                                className="text-muted-foreground hover:bg-accent hover:text-foreground h-8 w-8 transition-colors duration-150 sm:h-9 sm:w-9"
                                title={
                                  isAnyTaskRunning
                                    ? t(
                                        "history.menuDisabledWhileDownloading",
                                        "More actions are temporarily disabled while downloading",
                                      )
                                    : t("common.more", "More")
                                }
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              sideOffset={8}
                              className="border-border bg-card w-52 p-1"
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isAnyTaskRunning}
                                asChild
                                className="w-full justify-start"
                              >
                                <a
                                  href={getResourceUrl(r)}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => setOpenMenuTxId(null)}
                                >
                                  <Link2 className="mr-2 h-4 w-4" />
                                  {t("history.viewPreview", "Open preview")}
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isAnyTaskRunning}
                                className="w-full justify-start"
                                onClick={() => {
                                  setOpenMenuTxId(null)
                                  void handleCopyResourceUrl(
                                    r,
                                    r.encryptionAlgo !== "none" && !!masterKey,
                                  )
                                }}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                {t("history.copyUniqueResourceLink", "Copy preview link")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isAnyTaskRunning}
                                className="w-full justify-start"
                                onClick={() => {
                                  setOpenMenuTxId(null)
                                  void handleCopyDownloadUrl(
                                    r,
                                    r.encryptionAlgo !== "none" && !!masterKey,
                                  )
                                }}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                {t("history.copyDownloadLink", "Copy download link")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isAnyTaskRunning}
                                asChild
                                className="w-full justify-start"
                              >
                                <a
                                  href={getGatewayUrl(r)}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => setOpenMenuTxId(null)}
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  {t("history.openOriginalGateway", "Open gateway")}
                                </a>
                              </Button>
                            </PopoverContent>
                          </Popover>
                          {r.encryptionAlgo !== "none" && !masterKey ? (
                            // 加密文件但未解锁：显示两个按钮 - 下载加密版本和解密下载（禁用）
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDownload(r, false)}
                                disabled={!!downloading}
                                className="h-8 w-8 transition-colors duration-150 sm:h-9 sm:w-9"
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
                              {downloading === r.txId ? (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={cancelActiveDownload}
                                  className="h-8 w-8 sm:h-9 sm:w-9"
                                  title={t(
                                    "history.cancelDownload",
                                    "Cancel download",
                                  )}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              ) : null}
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
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleDownload(r, true)}
                                disabled={!!downloading}
                                className={`h-8 w-8 transition-colors duration-150 sm:h-9 sm:w-9 ${
                                  downloading === r.txId
                                    ? "border-ring bg-accent"
                                    : ""
                                }`}
                                title={
                                  r.encryptionAlgo !== "none"
                                    ? t(
                                        "history.downloadDecryptedTooltip",
                                        "Download decrypted file",
                                      )
                                    : t(
                                        "history.downloadTooltip",
                                        "Download file",
                                      )
                                }
                              >
                                {downloading === r.txId ? (
                                  <Loader2 className="text-foreground h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                              {downloading === r.txId ? (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={cancelActiveDownload}
                                  className="h-8 w-8 sm:h-9 sm:w-9"
                                  title={t(
                                    "history.cancelDownload",
                                    "Cancel download",
                                  )}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                        {downloading === r.txId && activeTask ? (
                          <div className="mt-2 space-y-1">
                            <div className="bg-border/70 h-1.5 w-full overflow-hidden rounded-full">
                              <div
                                className="bg-primary h-full rounded-full transition-[width] duration-150"
                                style={{
                                  width: `${
                                    getProgressPercent({
                                      loaded: activeTask.loaded,
                                      total: activeTask.total,
                                    }) ?? 100
                                  }%`,
                                }}
                              />
                            </div>
                            <p className="text-muted-foreground text-[10px]">
                              {activeTask.total && activeTask.total > 0
                                ? `${getProgressPercent({ loaded: activeTask.loaded, total: activeTask.total })?.toFixed(1)}% (${activeTask.loaded.toLocaleString()}/${activeTask.total.toLocaleString()} bytes)`
                                : `${activeTask.loaded.toLocaleString()} bytes`}
                            </p>
                          </div>
                        ) : null}
                      </td>
                </tr>
              )
            })}
            {records.length === 0 && (
              <tr>
                <td
                  className="text-muted-foreground px-4 py-10 text-center text-sm font-medium italic sm:px-6"
                  colSpan={8}
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
