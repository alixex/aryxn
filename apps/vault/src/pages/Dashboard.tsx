import { useWallet } from "@/hooks/account-hooks"
import { useTranslation } from "@/i18n/config"
import type { UploadRecord, WalletRecord } from "@/lib/utils"
import { searchFiles, type FileIndex } from "@/lib/file"
import { useEffect, useState } from "react"
import { Chains } from "@aryxn/chain-constants"
import { HistoryTable } from "@/components/history-table"
import { TransactionHistory } from "@/components/swap/TransactionHistory"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Link, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useFileSync } from "@/hooks/upload-hooks"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { AccountStatusBadge } from "@/components/account/AccountStatusBadge"
import { PageHeader } from "@/components/layout/PageHeader"
import { useUserAccountSetup } from "@/hooks/account-hooks/use-user-account-setup"

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
  const wallet = useWallet()
  const walletManager = wallet.internal
  const externalWallets = wallet.external
  const [searchParams] = useSearchParams()

  const defaultTab =
    searchParams.get("tab") === "activity" ? "activity" : "files"
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 50

  const { syncing, syncFromArweave } = useFileSync()

  const collectArweaveAddresses = () => {
    const internalArweaveAddresses = walletManager.wallets
      .filter((walletRecord) => walletRecord.chain === Chains.ARWEAVE)
      .map((walletRecord) => walletRecord.address)

    const candidates = [...internalArweaveAddresses]

    if (externalWallets.arAddress) {
      candidates.push(externalWallets.arAddress)
    }

    return Array.from(new Set(candidates.filter(Boolean)))
  }

  // 加载上传历史 (First page / refresh)
  const loadUploadHistory = async (reset = false) => {
    const addresses = collectArweaveAddresses()

    if (addresses.length === 0) {
      setUploadHistory([])
      setHasMore(false)
      return
    }

    try {
      const currentOffset = reset ? 0 : offset
      if (reset) {
        setOffset(0)
        setIsLoadingMore(false)
      } else {
        setIsLoadingMore(true)
      }

      const allFiles: FileIndex[] = []

      for (const address of addresses) {
        const sqliteFiles = await searchFiles(address, {
          limit: PAGE_SIZE,
          offset: currentOffset,
        })
        allFiles.push(...sqliteFiles)
      }

      // 去重（基于 tx_id）
      const uniqueFiles = Array.from(
        new Map(allFiles.map((file) => [file.tx_id, file])).values(),
      )

      const newRecords = uniqueFiles
        .map(fileIndexToUploadRecord)
        .sort((a, b) => b.createdAt - a.createdAt)

      setHasMore(newRecords.length >= PAGE_SIZE)

      if (reset) {
        setUploadHistory(newRecords as UploadRecord[])
      } else {
        // 如果是加载更多，需要与现有的记录再次去重
        setUploadHistory((prev) => {
          const combined = [...prev, ...(newRecords as UploadRecord[])]
          return Array.from(
            new Map(combined.map((r) => [r.txId, r])).values(),
          ).sort((a, b) => b.createdAt - a.createdAt)
        })
      }

      if (!reset) {
        setOffset((prev) => prev + PAGE_SIZE)
      }
    } catch (error) {
      console.error("Failed to load upload history:", error)
      if (reset) setUploadHistory([])
    } finally {
      setIsLoadingMore(false)
    }
  }

  // 初始加载及账户改变时重置加载
  useEffect(() => {
    loadUploadHistory(true)
  }, [walletManager.wallets, externalWallets.arAddress])

  // 处理同步
  const handleSync = async () => {
    const success = await syncFromArweave()
    if (success) {
      // 同步成功后重新加载历史记录
      await loadUploadHistory(true)
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

  const { needsAccountSetup } = useUserAccountSetup()

  return (
    <div className="mesh-gradient relative min-h-screen">
      <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-4 sm:py-8">
        <PageHeader
          title={t("common.dashboard")}
          description={t("history.desc")}
          icon={
            <LayoutDashboard className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
          }
          iconContainerClassName="bg-gradient-primary glow-purple"
          rightSlot={
            <AccountStatusBadge
              label={t("common.activeAccountLabel")}
              value={
                walletManager.activeAddress
                  ? walletManager.wallets.find(
                      (w: WalletRecord) =>
                        w.address === walletManager.activeAddress,
                    )?.alias || "Unnamed"
                  : t("common.noAccount")
              }
              actionHref="/account"
              actionAriaLabel={t("common.account")}
              actionIcon={
                <Lock
                  className="text-muted-foreground h-4 w-4"
                  aria-hidden="true"
                />
              }
            />
          }
        />

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
          <Tabs defaultValue={defaultTab} className="w-full">
            <div className="mb-6 flex justify-start">
              <TabsList className="bg-muted flex h-auto w-max flex-nowrap gap-1 rounded-lg p-1 sm:w-auto">
                <TabsTrigger
                  value="files"
                  className="data-[state=active]:bg-background rounded-md px-4 py-2 text-xs font-semibold capitalize data-[state=active]:text-cyan-400 data-[state=active]:shadow-sm"
                >
                  {t("common.files", "Files")}
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="data-[state=active]:bg-background rounded-md px-4 py-2 text-xs font-semibold capitalize data-[state=active]:text-cyan-400 data-[state=active]:shadow-sm"
                >
                  {t("common.activity", "Activity")}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="files" className="mt-0 outline-none">
              <Card className="glass-premium animate-fade-in-down border-none shadow-2xl transition-all duration-500">
                <CardHeader className="glass-strong border-accent/30 bg-card/60 flex flex-col space-y-4 rounded-t-2xl border-b-2 p-6 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
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
                    <div className="mb-6 flex flex-col items-center gap-4 overflow-x-auto">
                      <HistoryTable
                        records={uploadHistory || []}
                        masterKey={walletManager.masterKey}
                        activeAddress={walletManager.activeAddress}
                      />
                      {hasMore && (
                        <Button
                          variant="outline"
                          onClick={() => loadUploadHistory(false)}
                          disabled={isLoadingMore}
                          className="mt-2 w-full sm:w-auto"
                        >
                          {isLoadingMore
                            ? "Loading..."
                            : t("common.loadMore", "Load More")}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-0 outline-none">
              <TransactionHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
