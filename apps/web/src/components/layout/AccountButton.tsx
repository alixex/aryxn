import { Link } from "react-router-dom"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { UserCircle, CreditCard, Settings, User } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import { useWallet } from "@/hooks/use-wallet"
import { shortenedAddress } from "@/lib/utils"
import {
  ArweaveIcon,
  EthereumIcon,
  SolanaIcon,
  BitcoinIcon,
  SuiIcon,
} from "@/components/icons"

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
  const active = wallet.active

  const hasAnyAccount = active.hasAny

  return (
    <div className="flex items-center gap-2">
      <ConnectButton.Custom>
        {({ account, chain, mounted }) => {
          const ready = mounted
          const connected = ready && !!account && !!chain

          const anyConnected = hasAnyAccount || connected

          return (
            <Link
              to="/account"
              className={`flex h-9 items-center gap-2 rounded-full border px-3 shadow-sm transition-all active:scale-95 sm:h-8 ${
                anyConnected
                  ? "border-border bg-card hover:bg-accent"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-foreground/20 hover:text-foreground border-dashed"
              }`}
            >
              <AccountButtonContent wallet={wallet} />
            </Link>
          )
        }}
      </ConnectButton.Custom>
      <Link
        to="/account"
        className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all active:scale-95 sm:hidden"
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
  const active = wallet.active

  // 未解锁状态且没有任何连接
  if (!walletManager.isUnlocked && !active.hasAny) {
    return (
      <>
        <UserCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        <span className="hidden text-xs font-bold sm:inline">
          {t("common.account")}
        </span>
      </>
    )
  }

  // 如果有任何活跃账户，尝试显示最优的一个（顺序：EVM > Arweave > Solana > Sui）
  const prioritizeAccount =
    active.evm || active.arweave || active.solana || active.sui

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
