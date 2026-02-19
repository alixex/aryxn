import { Link } from "react-router-dom"
import { useTranslation } from "@/i18n/config"
import { Button } from "@/components/ui/button"
import { Chains } from "@aryxn/chain-constants"
import {
  Lock,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Plus,
  Download,
} from "lucide-react"
import { generateArweaveWallet } from "@/lib/storage"
import { useWallet } from "@/hooks/account-hooks"
import { toast } from "sonner"

interface AccountSelectorProps {
  file: File | null
}

export function AccountSelector({ file }: AccountSelectorProps) {
  const { t } = useTranslation()
  const wallet = useWallet()
  const walletManager = wallet.internal
  const externalWallets = wallet.external

  const handleCreateArWallet = async () => {
    if (!walletManager.isUnlocked) {
      toast.error(t("history.errorLocked"))
      return
    }
    try {
      toast.info(t("upload.autoCreateArPreparing"))
      const { key, address } = await generateArweaveWallet()
      const alias = `AR-${address.slice(0, 6)}`
      // Convert JWKInterface to ArweaveJWK
      const arweaveKey = key as unknown as import("@/lib/types").ArweaveJWK
      await walletManager.addWallet(arweaveKey, alias)
      await walletManager.selectWallet(address)
      toast.success(t("upload.autoCreateArSuccess", { alias }))
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      toast.error(t("upload.autoCreateArFailed", { message: errorMessage }))
    }
  }

  const handleImportWallet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!walletManager.isUnlocked) {
      toast.error(t("history.errorLocked"))
      return
    }
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const key = JSON.parse(reader.result as string)
          const alias = prompt(
            t("identities.aliasPrompt"),
            file.name.replace(".json", ""),
          )
          if (!alias) return
          await walletManager.addWallet(key, alias)
          toast.success(t("identities.successAdded", { alias }))
        } catch {
          toast.error("Invalid Arweave key file")
        }
      }
      reader.readAsText(file)
    }
  }

  // 检查是否有可用的 Arweave 账户
  const activeArweave = wallet.active.arweave
  const hasAnyArweave = !!activeArweave

  // 检查是否可以上传
  const canUpload = file && hasAnyArweave

  if (!walletManager.isUnlocked && !externalWallets.isArConnected) {
    return (
      <div className="glass-premium hover:shadow-primary/5 space-y-4 border-none px-6 py-8 text-center shadow-2xl transition-all duration-500">
        <div className="bg-secondary mx-auto flex h-12 w-12 items-center justify-center rounded-full">
          <Lock className="text-foreground h-6 w-6" />
        </div>
        <p className="text-foreground px-2 text-sm leading-relaxed font-semibold">
          {t("upload.arweaveLockedHint")}
        </p>
        <Link to="/account">
          <Button
            variant="outline"
            className="border-border bg-background hover:bg-accent mt-2 rounded-xl"
          >
            {t("common.account")}
          </Button>
        </Link>
      </div>
    )
  }

  if (!hasAnyArweave) {
    return (
      <div className="glass-premium hover:shadow-primary/5 space-y-6 border-none px-6 py-8 text-center shadow-2xl transition-all duration-500">
        <div className="bg-secondary mx-auto flex h-12 w-12 items-center justify-center rounded-full">
          <Wallet className="text-foreground h-6 w-6" />
        </div>
        <div className="text-foreground text-sm font-bold">
          {walletManager.wallets.length === 0
            ? t("upload.arweaveNoAccount")
            : t("upload.arweaveSelectAccount")}
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("upload.oneClickCreateArHint")}
        </p>

        {walletManager.wallets.filter((w) => w.chain === Chains.ARWEAVE).length >
        0 ? (
          <div className="mx-auto grid max-w-md grid-cols-1 gap-3">
            {walletManager.wallets
              .filter((w) => w.chain === Chains.ARWEAVE)
              .map((w) => (
                <Button
                  key={w.id}
                  variant="outline"
                  className="group border-border bg-background hover:border-ring hover:bg-accent h-auto justify-start rounded-xl px-4 py-4 text-left shadow-sm transition-all hover:shadow-md"
                  onClick={() => walletManager.selectWallet(w.address)}
                >
                  <div className="flex w-full items-center gap-3">
                    <div className="bg-secondary group-hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <Wallet className="text-foreground h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 truncate text-left">
                      <div className="text-foreground text-sm font-bold">
                        {w.alias}
                      </div>
                      <div className="text-muted-foreground mt-0.5 max-w-full truncate font-mono text-[10px]">
                        {w.address}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
          </div>
        ) : (
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              onClick={handleCreateArWallet}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
            >
              <Plus className="mr-2 h-4 w-4" /> {t("upload.oneClickCreateAr")}
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                className="border-border bg-background hover:bg-accent w-full rounded-xl sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" /> {t("identities.import")}
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImportWallet}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activeArweave && (
        <div className="glass-premium hover:shadow-primary/5 flex items-center gap-3 border-none p-3 shadow-2xl transition-all duration-500 sm:px-4 sm:py-2">
          <div className="bg-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Wallet className="text-foreground h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-semibold">
                {activeArweave.isExternal
                  ? t("identities.arconnectWallet")
                  : walletManager.wallets.find(
                      (w) => w.address === activeArweave.address,
                    )?.alias || "Unnamed"}
              </span>
              <CheckCircle2 className="text-foreground h-4 w-4" />
            </div>
            <div className="text-muted-foreground mt-1 truncate font-mono text-xs">
              {activeArweave.address}
            </div>
          </div>
        </div>
      )}

      {/* 文件已选择但无法上传的提示 */}
      {file && !canUpload && (
        <div className="border-muted bg-card flex items-start gap-3 rounded-xl border-2 p-4">
          <AlertCircle className="text-muted-foreground h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="text-foreground text-sm font-semibold">
              {t("upload.fileSelectedButCannotUpload")}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {!hasAnyArweave
                ? t("upload.needAccountToUpload")
                : t("upload.needUnlockToUpload")}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
