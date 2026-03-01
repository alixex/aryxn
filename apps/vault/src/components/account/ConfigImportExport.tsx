import { useState, useRef } from "react"
import { useTranslation } from "@/i18n/config"
import { useInternal } from "@/hooks/account-hooks"
import { toast } from "sonner"
import { Chains } from "@aryxn/chain-constants"
import {
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { deriveKey } from "@aryxn/crypto"
import {
  exportConfig,
  importConfig,
  downloadConfig,
  readConfigFromFile,
  type ConfigExport,
} from "@/lib/wallet"

const VAULT_SALT_LEGACY = new Uint8Array([
  0x61, 0x6e, 0x61, 0x6d, 0x6e, 0x65, 0x73, 0x69, 0x73, 0x2d, 0x76, 0x61, 0x75,
  0x6c, 0x74, 0x31,
])

const getVaultId = async (key: Uint8Array) => {
  // Create a new ArrayBuffer to ensure compatibility
  const keyBuffer = new Uint8Array(key).buffer
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", keyBuffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16)
}

export function ConfigImportExport() {
  const { t } = useTranslation()
  const walletManager = useInternal()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    importedWallets: number
    importedMetadata: number
    importedUploads: number
    errors: string[]
  } | null>(null)
  const [includeUploads, setIncludeUploads] = useState(false)
  const [exportPassword, setExportPassword] = useState("")
  const [showExportPassword, setShowExportPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [importPassword, setImportPassword] = useState("")
  const [showImportPassword, setShowImportPassword] = useState(false)
  const [importPasswordError, setImportPasswordError] = useState("")
  const [selectedConfig, setSelectedConfig] = useState<ConfigExport | null>(
    null,
  )

  const verifyPassword = async (password: string): Promise<boolean> => {
    if (!walletManager.vaultId) return false
    try {
      const activeSalt = walletManager.systemSalt || VAULT_SALT_LEGACY
      const key = await deriveKey(password, activeSalt)
      const vid = await getVaultId(key)
      return vid === walletManager.vaultId
    } catch (error) {
      console.error("Password verification failed:", error)
      return false
    }
  }

  const handleExport = async () => {
    if (!walletManager.vaultId) {
      toast.error(t("identities.exportErrorNoVault"))
      return
    }

    if (!exportPassword) {
      setPasswordError(t("identities.passwordRequired"))
      return
    }

    // 验证密码
    const isValid = await verifyPassword(exportPassword)
    if (!isValid) {
      setPasswordError(t("unlock.incorrect"))
      return
    }

    setPasswordError("")
    setIsExporting(true)
    try {
      const config = await exportConfig(walletManager.vaultId, includeUploads)
      downloadConfig(config)
      toast.success(t("identities.exportSuccess"))
      setIsExportDialogOpen(false)
      setExportPassword("")
    } catch (error) {
      console.error("Export failed:", error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(t("identities.exportFailed", { message: errorMessage }))
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const config = await readConfigFromFile(file)
      setSelectedConfig(config)
      setImportPassword("")
      setImportPasswordError("")
      setImportResult(null)
    } catch (error) {
      console.error("Failed to read config file:", error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(t("identities.importFailed", { message: errorMessage }))
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleImport = async () => {
    if (!selectedConfig) {
      toast.error(t("identities.selectConfigFileFirst"))
      return
    }

    if (!importPassword) {
      setImportPasswordError(t("identities.importPasswordRequired"))
      return
    }

    if (!walletManager.vaultId || !walletManager.masterKey) {
      toast.error(t("identities.importErrorNoVault"))
      return
    }

    setIsImporting(true)
    setImportPasswordError("")
    setImportResult(null)

    try {
      const result = await importConfig(
        selectedConfig,
        walletManager.vaultId,
        importPassword,
        walletManager.masterKey,
        {
          overwriteExisting: false, // 默认不覆盖，避免意外丢失数据
          importUploads: includeUploads,
        },
      )

      setImportResult(result)

      if (result.success) {
        toast.success(
          t("identities.importSuccess", {
            wallets: result.importedWallets,
            metadata: result.importedMetadata,
          }),
        )
        // 刷新钱包列表，无需重新加载页面
        await walletManager.refreshWallets()

        // 自动同步文件记录（如果有 Arweave 账户）
        // 注意：需要在刷新钱包后获取最新的钱包列表
        setTimeout(async () => {
          try {
            const { syncFilesFromArweaveDirect } =
              await import("@/lib/file/file-sync-direct")
            // 获取最新的钱包列表
            const currentWallets = walletManager.wallets.filter(
              (w) => w.chain === Chains.ARWEAVE,
            )
            if (currentWallets.length > 0) {
              let syncedCount = 0
              // 尝试同步每个 Arweave 账户的文件记录（直接通过标签查询）
              for (const wallet of currentWallets) {
                try {
                  const result = await syncFilesFromArweaveDirect(
                    wallet.address,
                  )
                  if (result.added > 0 || result.updated > 0) {
                    syncedCount++
                  }
                } catch (error) {
                  console.warn(
                    `Failed to sync files for ${wallet.address}:`,
                    error,
                  )
                }
              }
              if (syncedCount > 0) {
                toast.info("文件记录已自动同步")
              }
            }
          } catch (error) {
            console.warn("Failed to sync files:", error)
            // 同步失败不影响导入流程
          }
        }, 500) // 延迟 500ms 确保钱包列表已更新

        // 清空状态
        setSelectedConfig(null)
        setImportPassword("")
        // 重置文件输入
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        toast.warning(
          t("identities.importPartialSuccess", {
            wallets: result.importedWallets,
            errors: result.errors.length,
          }),
        )
      }
    } catch (error) {
      console.error("Import failed:", error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      setImportPasswordError(
        errorMessage.includes("密码") || errorMessage.includes("password")
          ? t("identities.importPasswordIncorrect")
          : errorMessage,
      )
      setImportResult({
        success: false,
        importedWallets: 0,
        importedMetadata: 0,
        importedUploads: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  if (!walletManager.isUnlocked) {
    return null
  }

  return (
    <>
      <Card className="glass-premium animate-fade-in-down border-none shadow-2xl transition-all duration-500">
        <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
          <CardTitle className="text-foreground text-base font-bold">
            {t("identities.configSync")}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs font-medium">
            {t("identities.configSyncDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            <Dialog
              open={isExportDialogOpen}
              onOpenChange={(open) => {
                setIsExportDialogOpen(open)
                if (!open) {
                  // 关闭对话框时清空密码和错误信息
                  setExportPassword("")
                  setPasswordError("")
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="btn-interactive border-primary/50 bg-primary/20 hover:bg-primary/30 hover:border-primary/70 group shadow-primary/10 relative h-12 w-full overflow-hidden shadow-lg sm:flex-1"
                >
                  <div className="from-primary/30 absolute inset-0 bg-gradient-to-r to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <Download className="mr-2 h-4 w-4 shrink-0 text-white/90 transition-transform group-hover:-translate-y-0.5" />
                  <span className="truncate font-bold tracking-tight text-white">
                    {t("identities.export")}
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card/80 fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden border-white/10 p-0 backdrop-blur-xl sm:max-w-md">
                <div className="from-primary/10 bg-gradient-to-b to-transparent p-6 pb-0">
                  <DialogHeader>
                    <div className="bg-primary/10 border-primary/20 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-inner">
                      <ShieldCheck className="text-primary h-7 w-7" />
                    </div>
                    <DialogTitle className="from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-center text-2xl font-bold text-transparent">
                      {t("identities.exportConfig")}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground/80 mt-2 text-center text-sm">
                      {t("identities.exportConfigDesc")}
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="space-y-6 p-6">
                  <div className="space-y-4">
                    <div className="group relative overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <div className="absolute top-0 left-0 h-full w-1 bg-amber-500" />
                      <div className="mb-2 flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                        <p className="text-sm font-bold text-amber-200">
                          {t("identities.exportSecurityNotice")}
                        </p>
                      </div>
                      <ul className="mt-2 ml-8 space-y-2 text-xs leading-relaxed font-medium text-amber-200/80">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          <span>{t("identities.exportSecurityTip1")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          <span>{t("identities.exportSecurityTip2")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          <span>{t("identities.exportSecurityTip3")}</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="group relative">
                        <Input
                          id="export-password"
                          type={showExportPassword ? "text" : "password"}
                          placeholder={t("unlock.passwordPlaceholder")}
                          value={exportPassword}
                          onChange={(e) => {
                            setExportPassword(e.target.value)
                            setPasswordError("")
                          }}
                          className={`focus:border-primary/50 focus:ring-primary/20 h-12 border-white/10 bg-white/5 pr-11 transition-all ${
                            passwordError
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }`}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              exportPassword &&
                              !isExporting
                            ) {
                              handleExport()
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowExportPassword(!showExportPassword)
                          }
                          className="text-muted-foreground hover:text-primary absolute top-1/2 right-3 -translate-y-1/2 p-2 transition-colors"
                        >
                          {showExportPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {passwordError && (
                        <div className="text-destructive animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5 text-sm font-medium">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{passwordError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="group flex cursor-pointer items-center space-x-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                    <div className="relative flex h-5 w-5 items-center justify-center">
                      <input
                        type="checkbox"
                        id="include-uploads-export"
                        checked={includeUploads}
                        onChange={(e) => setIncludeUploads(e.target.checked)}
                        className="peer checked:border-primary checked:bg-primary h-5 w-5 cursor-pointer appearance-none rounded border-2 border-white/20 transition-all"
                      />
                      <div className="pointer-events-none absolute text-white opacity-0 transition-opacity peer-checked:opacity-100">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                    <label
                      htmlFor="include-uploads-export"
                      className="text-foreground/90 flex-1 cursor-pointer text-sm font-semibold select-none"
                    >
                      {t("identities.includeUploads")}
                    </label>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsExportDialogOpen(false)
                        setExportPassword("")
                        setPasswordError("")
                      }}
                      className="h-12 flex-1 font-semibold hover:bg-white/5"
                      disabled={isExporting}
                    >
                      {t("common.close")}
                    </Button>
                    <Button
                      onClick={handleExport}
                      disabled={isExporting || !exportPassword}
                      className="bg-primary text-primary-foreground hover:bg-primary-hover shadow-primary/40 btn-interactive h-12 flex-1 font-bold shadow-lg transition-all"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("identities.exporting")}
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          {t("identities.export")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isImportDialogOpen}
              onOpenChange={(open) => {
                setIsImportDialogOpen(open)
                if (!open) {
                  // 关闭对话框时清空状态
                  setSelectedConfig(null)
                  setImportPassword("")
                  setImportPasswordError("")
                  setImportResult(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ""
                  }
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="btn-interactive border-primary/50 bg-primary/20 hover:bg-primary/30 hover:border-primary/70 group shadow-primary/10 relative h-12 w-full overflow-hidden shadow-lg sm:flex-1"
                >
                  <div className="from-primary/30 absolute inset-0 bg-gradient-to-r to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <Upload className="mr-2 h-4 w-4 shrink-0 text-white/90 transition-transform group-hover:-translate-y-0.5" />
                  <span className="truncate font-bold tracking-tight text-white">
                    {t("identities.import")}
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card/80 fixed top-1/2 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden border-white/10 p-0 backdrop-blur-xl">
                <div className="from-primary/10 bg-gradient-to-b to-transparent p-6 pb-0">
                  <DialogHeader>
                    <div className="bg-primary/10 border-primary/20 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-inner">
                      <Upload className="text-primary h-7 w-7" />
                    </div>
                    <DialogTitle className="from-foreground to-foreground/70 bg-gradient-to-r bg-clip-text text-center text-2xl font-bold text-transparent">
                      {t("identities.importConfig")}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground/80 mt-2 text-center text-sm">
                      {t("identities.importConfigDesc")}
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="space-y-6 p-6">
                  {!selectedConfig ? (
                    <div className="space-y-6">
                      <div className="group flex cursor-pointer items-center space-x-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
                        <div className="relative flex h-5 w-5 items-center justify-center">
                          <input
                            type="checkbox"
                            id="include-uploads-import"
                            checked={includeUploads}
                            onChange={(e) =>
                              setIncludeUploads(e.target.checked)
                            }
                            className="peer checked:border-primary checked:bg-primary h-5 w-5 cursor-pointer appearance-none rounded border-2 border-white/20 transition-all"
                          />
                          <div className="pointer-events-none absolute text-white opacity-0 transition-opacity peer-checked:opacity-100">
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                        <label
                          htmlFor="include-uploads-import"
                          className="text-foreground/90 flex-1 cursor-pointer text-sm font-semibold select-none"
                        >
                          {t("identities.includeUploads")}
                        </label>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="hidden"
                      />

                      <Button
                        onClick={handleImportClick}
                        disabled={isImporting}
                        className="btn-interactive relative h-12 w-full overflow-hidden rounded-xl border border-white/20 bg-gradient-to-r from-indigo-600 to-violet-600 font-bold text-white shadow-lg ring-1 shadow-indigo-500/30 ring-white/10 hover:shadow-indigo-500/50"
                        variant="default"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <Upload className="mr-3 h-5 w-5 transition-transform group-hover:-translate-y-1" />
                        <span className="text-sm font-bold tracking-widest uppercase">
                          {t("identities.selectConfigFile")}
                        </span>
                      </Button>
                    </div>
                  ) : (
                    <div className="animate-in fade-in zoom-in-95 space-y-6 duration-300">
                      <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                        <div className="absolute top-0 left-0 h-full w-1 bg-emerald-500" />
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                          <span className="text-sm font-bold text-emerald-100">
                            {t("identities.configFileSelected")}
                          </span>
                        </div>
                        <p className="mt-2 ml-9 text-xs leading-relaxed font-medium text-emerald-200/70">
                          {t("identities.importPasswordHint")}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="group relative">
                          <Input
                            id="import-password"
                            type={showImportPassword ? "text" : "password"}
                            placeholder={t(
                              "identities.importPasswordPlaceholder",
                            )}
                            value={importPassword}
                            onChange={(e) => {
                              setImportPassword(e.target.value)
                              setImportPasswordError("")
                            }}
                            className={`focus:border-primary/50 focus:ring-primary/20 h-12 border-white/10 bg-white/5 pr-11 transition-all ${
                              importPasswordError
                                ? "border-destructive focus-visible:ring-destructive"
                                : ""
                            }`}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                importPassword &&
                                !isImporting
                              ) {
                                handleImport()
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowImportPassword(!showImportPassword)
                            }
                            className="text-muted-foreground hover:text-primary absolute top-1/2 right-3 -translate-y-1/2 p-2 transition-colors"
                          >
                            {showImportPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {importPasswordError && (
                          <div className="text-destructive animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5 text-sm font-medium">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{importPasswordError}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedConfig(null)
                            setImportPassword("")
                            setImportPasswordError("")
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""
                            }
                          }}
                          className="h-12 flex-1 font-semibold hover:bg-white/5"
                          disabled={isImporting}
                        >
                          {t("common.back")}
                        </Button>
                        <Button
                          onClick={handleImport}
                          disabled={isImporting || !importPassword}
                          className="bg-primary text-primary-foreground hover:bg-primary-hover shadow-primary/40 btn-interactive h-12 flex-1 font-bold shadow-lg transition-all"
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("identities.importing")}
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              {t("identities.import")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {importResult && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 rounded-xl border border-white/10 bg-white/5 p-5 duration-500">
                      <div className="mb-4 flex items-center gap-3">
                        <div
                          className={`rounded-lg p-2 ${importResult.success ? "bg-emerald-500/20" : "bg-amber-500/20"}`}
                        >
                          {importResult.success ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                          )}
                        </div>
                        <span className="text-lg font-bold">
                          {importResult.success
                            ? t("identities.importCompleted")
                            : t("identities.importCompletedWithErrors")}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                            <span className="text-foreground text-sm font-semibold">
                              {t("identities.importedWallets", {
                                count: importResult.importedWallets,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                            <span className="text-foreground text-sm font-semibold">
                              {t("identities.importedMetadata", {
                                count: importResult.importedMetadata,
                              })}
                            </span>
                          </div>
                          {includeUploads && (
                            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                              <span className="text-foreground text-sm font-semibold">
                                {t("identities.importedUploads", {
                                  count: importResult.importedUploads,
                                })}
                              </span>
                            </div>
                          )}
                        </div>

                        {importResult.errors.length > 0 && (
                          <div className="border-destructive/30 bg-destructive/5 mt-4 rounded-xl border p-4">
                            <div className="text-destructive mb-2 flex items-center gap-2 font-bold">
                              <AlertCircle className="h-4 w-4" />
                              <span>{t("identities.errors")}:</span>
                            </div>
                            <ul className="text-destructive/80 space-y-1.5 text-xs font-medium">
                              {importResult.errors.map((error, index) => (
                                <li
                                  key={index}
                                  className="flex items-start gap-2"
                                >
                                  <span className="mt-1">•</span>
                                  <span>{error}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
