import { useInternal, useExternalWallets } from "@/hooks/account-hooks"
import { useTranslation } from "@/i18n/config"
import type { UploadRecord, WalletRecord } from "@/lib/utils"
import { searchFiles, type FileIndex } from "@/lib/file"
import { useEffect, useState } from "react"
import { HistoryTable } from "@/components/history-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  History,
  Lock,
  LayoutDashboard,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Upload,
  HardDrive,
  Clock,
  FileText,
} from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useFileSync } from "@/hooks/upload-hooks"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"

// 将 FileIndex 转换为 UploadRecord 格式（用于兼容 HistoryTable）
function fileIndexToUploadRecord(file: FileIndex): UploadRecord {
  return {
    id: undefined,
    txId: file.tx_id,
    fileName: file.file_name,
    fileHash: file.file_hash,
    fileSize: file.file_size,
    mimeType: file.mime_type,
    storageType: file.storage_type as "arweave",
    ownerAddress: file.owner_address,
    encryptionAlgo: file.encryption_algo,
    encryptionParams: file.encryption_params,
    createdAt: file.created_at,
  }
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const walletManager = useInternal()
  const externalWallets = useExternalWallets().external
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([])
  const { syncing, syncFromArweave } = useFileSync()

  // 加载上传历史
  const loadUploadHistory = async () => {
    // 收集所有可能的地址（内部钱包 + 外部钱包）
    const addresses: string[] = []

    if (walletManager.activeAddress) {
      addresses.push(walletManager.activeAddress)
    }

    if (externalWallets.arAddress) {
      addresses.push(externalWallets.arAddress)
    }

    if (addresses.length === 0) {
      setUploadHistory([])
      return
    }

    try {
      // 从 SQLite 加载所有地址的文件
      const allFiles: FileIndex[] = []

      for (const address of addresses) {
        const sqliteFiles = await searchFiles(address, {
          limit: 1000, // 加载足够多的记录
        })
        allFiles.push(...sqliteFiles)
      }

      // 去重（基于 tx_id，因为同一个交易可能被多个地址查询到）
      const uniqueFiles = Array.from(
        new Map(allFiles.map((file) => [file.tx_id, file])).values(),
      )

      const records = uniqueFiles
        .map(fileIndexToUploadRecord)
        .sort((a, b) => b.createdAt - a.createdAt)

      setUploadHistory(records as UploadRecord[])
    } catch (error) {
      console.error("Failed to load upload history:", error)
      setUploadHistory([])
    }
  }

  useEffect(() => {
    loadUploadHistory()
  }, [walletManager.activeAddress, externalWallets.arAddress])

  // 在页面加载后，空闲时间自动同步文件
  useEffect(() => {
    // 收集所有需要同步的地址
    const addresses: string[] = []

    if (walletManager.activeAddress) {
      addresses.push(walletManager.activeAddress)
    }

    if (externalWallets.arAddress) {
      addresses.push(externalWallets.arAddress)
    }

    if (addresses.length === 0) {
      return
    }

    // 使用 scheduleAutoSync 在浏览器空闲时间自动同步
    const scheduleAutoSyncPromises = addresses.map(async (address) => {
      try {
        const { scheduleAutoSync } = await import("@/lib/file/file-sync-direct")
        scheduleAutoSync(address, (result) => {
          // 同步完成后重新加载历史记录
          if (result.added > 0 || result.updated > 0) {
            loadUploadHistory()
          }
        })
      } catch (error) {
        console.warn(`Failed to schedule auto sync for ${address}:`, error)
      }
    })

    // 等待所有调度完成（不阻塞）
    Promise.all(scheduleAutoSyncPromises).catch((error) => {
      console.warn("Failed to schedule auto sync:", error)
    })
  }, [walletManager.activeAddress, externalWallets.arAddress])

  // 处理同步
  const handleSync = async () => {
    const success = await syncFromArweave()
    if (success) {
      // 同步成功后重新加载历史记录
      await loadUploadHistory()
    }
  }

  // 计算统计数据
  const totalFiles = uploadHistory.length
  const totalSize = uploadHistory.reduce(
    (sum, file) => sum + (file.fileSize || 0),
    0,
  )
  const lastUploadTime = uploadHistory[0]?.createdAt
    ? new Date(uploadHistory[0].createdAt).toLocaleDateString(
        t("common.locale"),
        {
          month: "short",
          day: "numeric",
        },
      )
    : t("common.none")

  // 格式化文件大小
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  // 检查是否需要显示账户管理提示
  const needsAccountSetup =
    !walletManager.isUnlocked && !externalWallets.isArConnected

  return (
    <div className="mesh-gradient relative min-h-screen">
      <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-6xl space-y-8 px-4 py-8 duration-1000">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-3 text-4xl font-extrabold tracking-tighter sm:text-5xl">
              <div className="bg-gradient-primary glow-purple rounded-2xl p-2.5 text-white shadow-xl ring-1 ring-white/20">
                <LayoutDashboard className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <span className="bg-gradient-primary gradient-text leading-tight">
                {t("common.dashboard")}
              </span>
            </h2>
            <p className="text-subtitle-muted max-w-lg text-base leading-relaxed font-medium">
              {t("history.desc")}
            </p>
          </div>

          <div className="glass border-primary/20 bg-card/40 hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3 shadow-lg transition-all sm:px-4 sm:py-2">
            <div className="flex-1 sm:text-right">
              <div className="text-muted-foreground mb-0.5 text-[10px] font-bold tracking-wider uppercase">
                {t("common.activeAccountLabel")}
              </div>
              <div className="text-foreground max-w-45 truncate text-sm font-bold">
                {walletManager.activeAddress
                  ? walletManager.wallets.find(
                      (w: WalletRecord) =>
                        w.address === walletManager.activeAddress,
                    )?.alias || "Unnamed"
                  : t("common.noAccount")}
              </div>
            </div>
            <Link to="/account" className="sm:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-primary hover:bg-primary/20 h-8 w-8"
                aria-label={t("common.account")}
              >
                <Lock
                  className="text-muted-foreground h-4 w-4"
                  aria-hidden="true"
                />
              </Button>
            </Link>
          </div>
        </div>

        {needsAccountSetup && (
          <div className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 flex items-start gap-4 rounded-2xl border-2 p-6 shadow-lg">
            <div className="bg-accent/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <AlertCircle className="text-accent h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="mb-2 text-base leading-relaxed font-bold">
                {t("history.needAccountSetup")}
              </p>
              <p className="text-subtitle-muted mb-3 text-sm leading-relaxed">
                {t("history.accountSetupHint")}
              </p>
              <Link to="/account">
                <Button
                  variant="outline"
                  className="border-border bg-background text-foreground hover:bg-accent rounded-lg font-semibold"
                >
                  {t("upload.goToAccount")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {!needsAccountSetup && uploadHistory.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Upload className="h-5 w-5" />}
              label={t("history.totalFiles", "总文件数")}
              value={totalFiles}
            />
            <StatCard
              icon={<HardDrive className="h-5 w-5" />}
              label={t("history.totalStorage", "总存储空间")}
              value={formatBytes(totalSize)}
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label={t("history.lastUpload", "最近上传")}
              value={lastUploadTime}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:gap-8">
          <Card className="border-border overflow-hidden shadow-sm">
            <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:pb-6">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <History className="text-foreground h-5 w-5" />
                  {t("history.title")}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {t("history.desc")}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!walletManager.isUnlocked ? (
                  <Link to="/account" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-muted bg-card text-muted-foreground hover:bg-accent w-full sm:w-auto"
                    >
                      <Lock className="mr-2 h-3.5 w-3.5" />
                      {t("common.accountLocked")}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={syncing}
                    className="group w-full sm:w-auto"
                  >
                    <RefreshCw
                      className={`mr-2 h-3.5 w-3.5 transition-transform duration-200 ${syncing ? "animate-spin" : "group-hover:rotate-180"}`}
                    />
                    {syncing
                      ? t("history.syncing") + "…"
                      : t("history.syncFromArweave")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {uploadHistory.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-12 w-12" />}
                  title={t("history.emptyTitle")}
                  description={t("history.emptyDesc")}
                  action={
                    <Link to="/upload">
                      <Button className="mt-2">
                        <Upload className="mr-2 h-4 w-4" />
                        {t("common.upload", "立即上传")}
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <HistoryTable
                    records={uploadHistory || []}
                    masterKey={walletManager.masterKey}
                    activeAddress={walletManager.activeAddress}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
