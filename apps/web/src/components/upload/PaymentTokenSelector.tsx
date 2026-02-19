import { useTranslation } from "@/i18n/config"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Wallet, Coins, RefreshCw } from "lucide-react"
import type { PaymentAccount, PaymentToken } from "@/lib/payment"
import {
  getUploadPaymentSupportedChains,
  getUploadSelectableTokensByChain,
} from "@/lib/payment"
import { useWallet } from "@/hooks/account-hooks"
import { useEffect, useMemo, useState } from "react"
import { getBalance } from "@/lib/chain"
import { TOKEN_ADDRESSES } from "@/lib/contracts/addresses"
import { Chains } from "@aryxn/chain-constants"

interface PaymentTokenSelectorProps {
  selectedToken: PaymentToken
  selectedAccount: PaymentAccount | null
  onSelectToken: (token: PaymentToken) => void
  onSelectAccount: (account: PaymentAccount | null) => void
}

function formatAddress(addr: string) {
  if (!addr) return ""
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function accountValue(account: PaymentAccount) {
  return `${account.chain}:${account.address}`
}

export function PaymentTokenSelector({
  selectedToken,
  selectedAccount,
  onSelectToken,
  onSelectAccount,
}: PaymentTokenSelectorProps) {
  const { t } = useTranslation()
  const wallet = useWallet()
  const [balance, setBalance] = useState<string>("0.00")
  const [lastUpdated, setLastUpdated] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const accountsByChain = wallet.getAccountsByChain()
  const supportedChains = getUploadPaymentSupportedChains()
  const selectableTokens = useMemo(
    () => getUploadSelectableTokensByChain(selectedAccount?.chain),
    [selectedAccount?.chain],
  )

  const supportedAccounts = useMemo(() => {
    return supportedChains.flatMap((chain) => {
      const accounts = accountsByChain[chain] || []
      return accounts.map((account) => ({
        chain: account.chain,
        address: account.address,
        alias: account.alias,
        isExternal: account.isExternal,
      }))
    })
  }, [accountsByChain, supportedChains])

  useEffect(() => {
    if (supportedAccounts.length === 0) {
      if (selectedAccount) {
        onSelectAccount(null)
      }
      return
    }

    const selectedStillExists =
      selectedAccount &&
      supportedAccounts.some(
        (account) =>
          account.chain === selectedAccount.chain &&
          account.address === selectedAccount.address,
      )

    if (!selectedStillExists) {
      onSelectAccount(supportedAccounts[0])
    }
  }, [supportedAccounts, selectedAccount, onSelectAccount])

  useEffect(() => {
    if (selectableTokens.length === 0) return
    if (!selectableTokens.includes(selectedToken)) {
      onSelectToken(selectableTokens[0])
    }
  }, [selectableTokens, selectedToken, onSelectToken])

  const fetchBalance = async () => {
    if (!selectedAccount) {
      setBalance("0.00")
      return
    }

    setIsLoading(true)
    try {
      const tokenAddress =
        selectedAccount.chain === Chains.ETHEREUM
          ? (TOKEN_ADDRESSES as Record<string, string>)[selectedToken]
          : undefined

      const res = await getBalance(
        selectedAccount.chain,
        selectedAccount.address,
        tokenAddress,
      )
      setBalance(res.formatted)

      const now = new Date()
      setLastUpdated(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      )
    } catch (error) {
      console.error("Failed to fetch balance:", error)
      setBalance("Error")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [selectedToken, selectedAccount])

  const handleAccountChange = (value: string) => {
    const nextAccount = supportedAccounts.find(
      (item) => accountValue(item) === value,
    )
    onSelectAccount(nextAccount || null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Coins className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground text-sm font-semibold">
          {t("upload.paymentMethod") || "支付方式"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={selectedAccount ? accountValue(selectedAccount) : undefined}
          onValueChange={handleAccountChange}
        >
          <SelectTrigger className="border-border bg-background h-12 w-full rounded-xl shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-2">
              <Wallet className="text-muted-foreground h-4 w-4" />
              <SelectValue
                placeholder={t(
                  "upload.selectPaymentAccount",
                  "Select payment account",
                )}
              />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border shadow-lg">
            {supportedAccounts.map((account) => (
              <SelectItem
                key={accountValue(account)}
                value={accountValue(account)}
                className="cursor-pointer rounded-lg"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">
                    {account.alias ||
                      (account.isExternal
                        ? "External Wallet"
                        : "Private Vault")}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {account.chain} · {formatAddress(account.address)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedToken}
          onValueChange={(val) => onSelectToken(val as PaymentToken)}
          disabled={selectableTokens.length === 0}
        >
          <SelectTrigger className="border-border bg-background h-12 w-full rounded-xl shadow-sm transition-all hover:shadow-md">
            <SelectValue
              placeholder={t(
                "upload.selectPaymentToken",
                "Select payment token",
              )}
            />
          </SelectTrigger>
          <SelectContent className="rounded-xl border shadow-lg">
            {selectableTokens.map((token) => (
              <SelectItem
                key={token}
                value={token}
                className="cursor-pointer rounded-lg"
              >
                {token}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>{t("common.balance")}:</span>
          <span className="text-foreground font-mono font-medium">
            {balance} {selectedToken}
          </span>
        </div>

        <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
          {isLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
          <span>
            {t("common.updatedAt", "Updated at")} {lastUpdated}
          </span>
        </div>
      </div>
    </div>
  )
}
