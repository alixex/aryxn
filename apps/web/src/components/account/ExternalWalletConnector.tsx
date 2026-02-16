import { Button } from "@/components/ui/button"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "@/i18n/config"
import {
  EthereumIcon,
  ArweaveIcon,
  SolanaIcon,
  SuiIcon,
} from "@/components/icons"

interface ExternalWalletConnectorProps {
  // EVM
  isPaymentConnected: boolean
  paymentAddress?: string
  allEVMAddresses: string[]
  // Arweave
  isArConnected: boolean
  arAddress: string | null
  connectArweave: () => void
  // Solana
  isSolConnected: boolean
  solAddress: string | null
  connectSolana: () => void
  disconnectSolana: () => void
  // Sui
  isSuiConnected: boolean
  suiAddress: string | null
  connectSui: () => void
  disconnectSui: () => void
}

export function ExternalWalletConnector({
  isPaymentConnected,
  paymentAddress,
  allEVMAddresses,
  isArConnected,
  arAddress,
  connectArweave,
  isSolConnected,
  solAddress,
  connectSolana,
  disconnectSolana,
  isSuiConnected,
  suiAddress,
  connectSui,
  disconnectSui,
}: ExternalWalletConnectorProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground mb-4 text-xs">
        {t("identities.connectExternalDesc")}
      </p>
      <div className="grid grid-cols-1 gap-3">
        {/* EVM 钱包连接 */}
        <ConnectButton.Custom>
          {({ openConnectModal, openAccountModal }) => {
            const handleSwitchAccount = () => {
              if (typeof openAccountModal === "function") {
                openAccountModal()
              }
            }

            return (
              <Button
                variant="outline"
                onClick={
                  isPaymentConnected ? handleSwitchAccount : openConnectModal
                }
                className={`flex h-20 w-full items-center justify-start gap-3 rounded-lg transition-all ${
                  isPaymentConnected
                    ? "border-green-200 bg-green-50/50 hover:border-green-300 hover:bg-green-50"
                    : "border-border hover:border-ring hover:bg-accent"
                }`}
              >
                <div
                  className={`rounded-lg p-2 ${
                    isPaymentConnected
                      ? "bg-green-100 text-green-600"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  <EthereumIcon className="h-5 w-5" />
                </div>
                <div className="flex flex-1 flex-col items-start">
                  <span
                    className={`text-sm font-semibold ${
                      isPaymentConnected ? "text-green-700" : "text-foreground"
                    }`}
                  >
                    {isPaymentConnected
                      ? t("identities.evmWalletAccounts", {
                          count: allEVMAddresses.length,
                        })
                      : t("identities.evmWallet")}
                  </span>
                  <span
                    className={`text-xs ${
                      isPaymentConnected
                        ? "font-mono text-green-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {isPaymentConnected
                      ? `${paymentAddress?.slice(0, 10)}...${paymentAddress?.slice(-8)}`
                      : t("identities.evmWalletProviders")}
                  </span>
                </div>
                <ExternalLink
                  className={`h-4 w-4 ${
                    isPaymentConnected
                      ? "text-green-500"
                      : "text-muted-foreground"
                  }`}
                />
              </Button>
            )
          }}
        </ConnectButton.Custom>

        {/* Arweave 钱包连接 */}
        <Button
          variant="outline"
          onClick={connectArweave}
          className={`flex h-20 w-full items-center justify-start gap-3 rounded-lg transition-all ${
            isArConnected
              ? "border-green-200 bg-green-50/50 hover:border-green-300 hover:bg-green-50"
              : "border-border hover:border-ring hover:bg-accent"
          }`}
        >
          <div
            className={`rounded-lg p-2 ${
              isArConnected
                ? "bg-green-100 text-green-600"
                : "bg-secondary text-foreground"
            }`}
          >
            <ArweaveIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-1 flex-col items-start">
            <span
              className={`text-sm font-semibold ${
                isArConnected ? "text-green-700" : "text-foreground"
              }`}
            >
              {isArConnected
                ? t("identities.arconnectWalletConnected")
                : t("identities.arconnectWallet")}
            </span>
            <span
              className={`text-xs ${
                isArConnected
                  ? "font-mono text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              {isArConnected
                ? `${arAddress?.slice(0, 10)}...${arAddress?.slice(-8)}`
                : t("identities.arweaveEcosystem")}
            </span>
          </div>
          <ExternalLink
            className={`h-4 w-4 ${
              isArConnected ? "text-green-500" : "text-muted-foreground"
            }`}
          />
        </Button>

        {/* Solana 钱包连接 */}
        <Button
          variant="outline"
          onClick={isSolConnected ? disconnectSolana : connectSolana}
          className={`flex h-20 w-full items-center justify-start gap-3 rounded-lg transition-all ${
            isSolConnected
              ? "border-green-200 bg-green-50/50 hover:border-green-300 hover:bg-green-50"
              : "border-border hover:border-ring hover:bg-accent"
          }`}
        >
          <div
            className={`rounded-lg p-2 ${
              isSolConnected
                ? "bg-green-100 text-green-600"
                : "bg-secondary text-foreground"
            }`}
          >
            <SolanaIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-1 flex-col items-start">
            <span
              className={`text-sm font-semibold ${
                isSolConnected ? "text-green-700" : "text-foreground"
              }`}
            >
              {isSolConnected
                ? t("identities.phantomWalletConnected")
                : t("identities.phantomWallet")}
            </span>
            <span
              className={`text-xs ${
                isSolConnected
                  ? "font-mono text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              {isSolConnected
                ? `${solAddress?.slice(0, 10)}...${solAddress?.slice(-8)}`
                : t("identities.solanaEcosystem")}
            </span>
          </div>
          <ExternalLink
            className={`h-4 w-4 ${
              isSolConnected ? "text-green-500" : "text-muted-foreground"
            }`}
          />
        </Button>

        {/* Sui 钱包连接 */}
        <Button
          variant="outline"
          onClick={isSuiConnected ? disconnectSui : connectSui}
          className={`flex h-20 w-full items-center justify-start gap-3 rounded-lg transition-all ${
            isSuiConnected
              ? "border-green-200 bg-green-50/50 hover:border-green-300 hover:bg-green-50"
              : "border-border hover:border-ring hover:bg-accent"
          }`}
        >
          <div
            className={`rounded-lg p-2 ${
              isSuiConnected
                ? "bg-green-100 text-green-600"
                : "bg-secondary text-foreground"
            }`}
          >
            <SuiIcon className="h-5 w-5" />
          </div>
          <div className="flex flex-1 flex-col items-start">
            <span
              className={`text-sm font-semibold ${
                isSuiConnected ? "text-green-700" : "text-foreground"
              }`}
            >
              {isSuiConnected
                ? t("identities.suiWalletConnected")
                : t("identities.suiWallet")}
            </span>
            <span
              className={`text-xs ${
                isSuiConnected
                  ? "font-mono text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              {isSuiConnected
                ? `${suiAddress?.slice(0, 10)}...${suiAddress?.slice(-8)}`
                : t("identities.suiEcosystem")}
            </span>
          </div>
          <ExternalLink
            className={`h-4 w-4 ${
              isSuiConnected ? "text-green-500" : "text-muted-foreground"
            }`}
          />
        </Button>
      </div>
    </div>
  )
}
