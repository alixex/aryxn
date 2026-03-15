import { Link } from "react-router-dom"
import { UserCircle, CreditCard, Settings, User } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { useWallet } from "@/hooks/account-hooks"
import { shortenedAddress } from "@/lib/utils"
import {
  ArweaveIcon,
  EthereumIcon,
  SolanaIcon,
  BitcoinIcon,
  SuiIcon,
} from "@/components/icons"
import { Chains } from "@aryxn/chain-constants"

/**
 * 根据链类型获取对应的图标组件
 */
function getChainIcon(chain?: string) {
  switch (chain?.toLowerCase()) {
    case "ethereum":
      return <EthereumIcon className="h-3.5 w-3.5" />
    case "solana":
      return <SolanaIcon className="h-3.5 w-3.5" />
    case "bitcoin":
      return <BitcoinIcon className="h-3.5 w-3.5" />
    case "sui":
      return <SuiIcon className="h-3.5 w-3.5" />
    case "arweave":
      return <ArweaveIcon className="h-3.5 w-3.5" />
    default:
      return <User className="h-3.5 w-3.5" />
  }
}

export function AccountButton() {
  const wallet = useWallet()
  const walletManager = wallet.internal

  const hasAnyAccount = walletManager.wallets.length > 0

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/account"
        className={`flex h-9 items-center gap-2 rounded-full border px-3 shadow-sm transition-all active:scale-[0.99] sm:h-8 ${
          hasAnyAccount
            ? "border-border/95 bg-card/90 hover:bg-accent"
            : "border-border/85 bg-muted/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground border-dashed"
        }`}
      >
        <AccountButtonContent wallet={wallet} />
      </Link>
      <Link
        to="/account"
        className="border-border/95 bg-card/90 text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all active:scale-[0.99] sm:hidden"
      >
        <Settings className="h-5 w-5" />
      </Link>
    </div>
  )
}

interface AccountButtonContentProps {
  wallet: ReturnType<typeof useWallet>
}

function AccountButtonContent({ wallet }: AccountButtonContentProps) {
  const { t } = useTranslation()
  const walletManager = wallet.internal

  // 未解锁状态或没有任何账户
  if (!walletManager.isUnlocked || walletManager.wallets.length === 0) {
    return (
      <>
        <UserCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        <span className="hidden text-xs font-bold sm:inline">
          {t("common.account")}
        </span>
      </>
    )
  }

  // 尝试显示活跃账户，如果没有，显示第一个 Arweave 账户，再如果没有，显示第一个任何账户
  const activeAccount = walletManager.wallets.find(
    (w) => w.address === walletManager.activeAddress,
  )
  const fallbackArweave = walletManager.wallets.find(
    (w) => w.chain === Chains.ARWEAVE,
  )
  const prioritizeAccount =
    activeAccount || fallbackArweave || walletManager.wallets[0]

  if (prioritizeAccount) {
    return (
      <>
        <div className="flex h-3.5 w-3.5 items-center justify-center">
          {getChainIcon(prioritizeAccount.chain)}
        </div>
        <span className="text-foreground text-xs font-bold">
          {shortenedAddress(prioritizeAccount.address)}
        </span>
      </>
    )
  }

  // 默认状态
  return (
    <>
      <CreditCard className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      <span className="hidden text-xs font-bold sm:inline">
        {t("common.account")}
      </span>
    </>
  )
}
