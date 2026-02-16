import { useState, useRef } from "react"
import { useTranslation } from "@/i18n/config"
import { useInternal } from "@/hooks/account-hooks"
import { toast } from "sonner"
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
              (w) => w.chain === "arweave",
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
      <Card className="border-border shadow-sm">
        <CardHeader className="border-border bg-secondary/50 border-b pb-3">
          <CardTitle className="text-foreground text-base">
            {t("identities.configSync")}
          </CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
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
                <Button variant="outline" className="w-full sm:flex-1">
                  <Download className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{t("identities.export")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <div className="bg-secondary mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                    <ShieldCheck className="text-foreground h-6 w-6" />
                  </div>
                  <DialogTitle className="text-center text-xl">
                    {t("identities.exportConfig")}
                  </DialogTitle>
                  <DialogDescription className="text-center text-sm">
                    {t("identities.exportConfigDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-2 flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-xs font-semibold text-amber-900">
                          {t("identities.exportSecurityNotice")}
                        </p>
                      </div>
                      <ul className="mt-2 ml-6 space-y-1.5 text-xs text-amber-800">
                        <li className="flex items-start gap-1.5">
                          <span className="mt-0.5">•</span>
                          <span>{t("identities.exportSecurityTip1")}</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="mt-0.5">•</span>
                          <span>{t("identities.exportSecurityTip2")}</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="mt-0.5">•</span>
                          <span>{t("identities.exportSecurityTip3")}</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          id="export-password"
                          type={showExportPassword ? "text" : "password"}
                          placeholder={t("unlock.passwordPlaceholder")}
                          value={exportPassword}
                          onChange={(e) => {
                            setExportPassword(e.target.value)
                            setPasswordError("")
                          }}
                          className={`h-11 pr-11 ${
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
                          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                        >
                          {showExportPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {passwordError && (
                        <div className="text-destructive flex items-center gap-1.5 text-sm">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{passwordError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-border bg-secondary/50 flex items-center space-x-2 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      id="include-uploads-export"
                      checked={includeUploads}
                      onChange={(e) => setIncludeUploads(e.target.checked)}
                      className="border-border text-foreground focus:ring-ring h-4 w-4 rounded"
                    />
                    <label
                      htmlFor="include-uploads-export"
                      className="text-foreground flex-1 cursor-pointer text-sm"
                    >
                      {t("identities.includeUploads")}
                    </label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsExportDialogOpen(false)
                        setExportPassword("")
                        setPasswordError("")
                      }}
                      className="flex-1"
                      disabled={isExporting}
                    >
                      {t("common.close")}
                    </Button>
                    <Button
                      onClick={handleExport}
                      disabled={isExporting || !exportPassword}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
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
                <Button variant="outline" className="w-full sm:flex-1">
                  <Upload className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{t("identities.import")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <div className="bg-secondary mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
                    <ShieldCheck className="text-foreground h-6 w-6" />
                  </div>
                  <DialogTitle className="text-center text-xl">
                    {t("identities.importConfig")}
                  </DialogTitle>
                  <DialogDescription className="text-center text-sm">
                    {t("identities.importConfigDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                  {!selectedConfig ? (
                    <>
                      <div className="border-border bg-secondary/50 flex items-center space-x-2 rounded-lg border p-3">
                        <input
                          type="checkbox"
                          id="include-uploads-import"
                          checked={includeUploads}
                          onChange={(e) => setIncludeUploads(e.target.checked)}
                          className="border-border text-foreground focus:ring-ring h-4 w-4 rounded"
                        />
                        <label
                          htmlFor="include-uploads-import"
                          className="text-foreground flex-1 cursor-pointer text-sm"
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
                        className="w-full"
                        variant="outline"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {t("identities.selectConfigFile")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-900">
                            {t("identities.configFileSelected")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-green-700">
                          {t("identities.importPasswordHint")}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
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
                            className={`h-11 pr-11 ${
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
                            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                          >
                            {showImportPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {importPasswordError && (
                          <div className="text-destructive flex items-center gap-1.5 text-sm">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{importPasswordError}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedConfig(null)
                            setImportPassword("")
                            setImportPasswordError("")
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ""
                            }
                          }}
                          className="flex-1"
                          disabled={isImporting}
                        >
                          {t("common.back")}
                        </Button>
                        <Button
                          onClick={handleImport}
                          disabled={isImporting || !importPassword}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
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
                    </>
                  )}

                  {importResult && (
                    <div className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center gap-2">
                        {importResult.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                        )}
                        <span className="font-semibold">
                          {importResult.success
                            ? t("identities.importCompleted")
                            : t("identities.importCompletedWithErrors")}
                        </span>
                      </div>
                      <div className="text-muted-foreground space-y-1 text-sm">
                        <div>
                          {t("identities.importedWallets", {
                            count: importResult.importedWallets,
                          })}
                        </div>
                        <div>
                          {t("identities.importedMetadata", {
                            count: importResult.importedMetadata,
                          })}
                        </div>
                        {includeUploads && (
                          <div>
                            {t("identities.importedUploads", {
                              count: importResult.importedUploads,
                            })}
                          </div>
                        )}
                        {importResult.errors.length > 0 && (
                          <div className="mt-2 rounded bg-yellow-50 p-2">
                            <div className="mb-1 font-semibold text-yellow-800">
                              {t("identities.errors")}:
                            </div>
                            <ul className="list-disc pl-5 text-xs text-yellow-700">
                              {importResult.errors.map((error, index) => (
                                <li key={index}>{error}</li>
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
