import { useState } from "react"
import { useTranslation } from "@/i18n/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Eye, EyeOff } from "lucide-react"
import {
  EthereumIcon,
  BitcoinIcon,
  SolanaIcon,
  SuiIcon,
  ArweaveIcon,
} from "@/components/icons"

import { ExternalWalletConnector } from "./ExternalWalletConnector"

interface AddAccountSectionProps {
  onAddAccount: (input: string, alias: string) => Promise<void>
  onCreateAccount: (chain: string) => Promise<void>
  // External wallet props
  isPaymentConnected: boolean
  paymentAddress?: string
  allEVMAddresses: string[]
  isArConnected: boolean
  arAddress: string | null
  connectArweave: () => void
  isSolConnected: boolean
  solAddress: string | null
  connectSolana: () => void
  disconnectSolana: () => void
  isSuiConnected: boolean
  suiAddress: string | null
  connectSui: () => void
  disconnectSui: () => void
}

export function AddAccountSection({
  onAddAccount,
  onCreateAccount,
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
}: AddAccountSectionProps) {
  const { t } = useTranslation()
  const [newAccountInput, setNewAccountInput] = useState("")
  const [newAccountAlias, setNewAccountAlias] = useState("")
  const [showImportKey, setShowImportKey] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccountInput || !newAccountAlias) {
      return
    }
    await onAddAccount(newAccountInput, newAccountAlias)
    setNewAccountInput("")
    setNewAccountAlias("")
  }

  const chains = [
    {
      id: "ethereum",
      name: "Ethereum",
      icon: <EthereumIcon className="h-5 w-5" />,
    },
    {
      id: "bitcoin",
      name: "Bitcoin",
      icon: <BitcoinIcon className="h-5 w-5" />,
    },
    { id: "solana", name: "Solana", icon: <SolanaIcon className="h-5 w-5" /> },
    { id: "sui", name: "Sui", icon: <SuiIcon className="h-5 w-5" /> },
    {
      id: "arweave",
      name: "Arweave",
      icon: <ArweaveIcon className="h-5 w-5" />,
    },
  ]

  return (
    <Card className="border-border overflow-hidden shadow-sm">
      <CardHeader className="border-border bg-secondary/50 border-b pb-3">
        <CardTitle className="text-foreground flex items-center gap-2 text-base">
          <Plus className="text-foreground h-4 w-4" />
          {t("identities.addNew")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="bg-secondary mx-4 mt-4 mb-0 h-auto w-auto rounded-lg p-1">
            <TabsTrigger
              value="import"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground rounded-md px-4 py-2 text-xs font-semibold data-[state=active]:shadow-sm"
            >
              {t("identities.import")}
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground rounded-md px-4 py-2 text-xs font-semibold data-[state=active]:shadow-sm"
            >
              {t("identities.new")}
            </TabsTrigger>
            <TabsTrigger
              value="connect"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground rounded-md px-4 py-2 text-xs font-semibold data-[state=active]:shadow-sm"
            >
              {t("identities.connectExternal")}
            </TabsTrigger>
          </TabsList>

          <div className="p-6 pt-4">
            <TabsContent value="import" className="mt-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-foreground text-xs font-semibold">
                      {t("identities.aliasLabel")}
                    </label>
                    <Input
                      placeholder={t("identities.aliasPlaceholder")}
                      value={newAccountAlias}
                      onChange={(e) => setNewAccountAlias(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-foreground text-xs font-semibold">
                      {t("identities.keyLabel")}
                    </label>
                    <div className="relative">
                      <Input
                        type={showImportKey ? "text" : "password"}
                        placeholder={t("identities.keyPlaceholder")}
                        value={newAccountInput}
                        onChange={(e) => setNewAccountInput(e.target.value)}
                        className="rounded-lg pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowImportKey(!showImportKey)}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                      >
                        {showImportKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full rounded-lg font-semibold"
                >
                  {t("identities.addSubmit")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="create" className="mt-0">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {chains.map((chain) => (
                  <Button
                    key={chain.id}
                    variant="outline"
                    onClick={() => onCreateAccount(chain.id)}
                    className="border-border hover:border-ring hover:bg-accent flex h-24 flex-col gap-2 rounded-lg transition-all"
                  >
                    <div className="bg-secondary text-foreground group-hover:bg-muted group-hover:text-foreground rounded-lg p-2 transition-colors">
                      {chain.icon}
                    </div>
                    <span className="text-foreground text-xs font-semibold">
                      {chain.name}
                    </span>
                  </Button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="connect" className="mt-0">
              <ExternalWalletConnector
                isPaymentConnected={isPaymentConnected}
                paymentAddress={paymentAddress}
                allEVMAddresses={allEVMAddresses}
                isArConnected={isArConnected}
                arAddress={arAddress}
                connectArweave={connectArweave}
                isSolConnected={isSolConnected}
                solAddress={solAddress}
                connectSolana={connectSolana}
                disconnectSolana={disconnectSolana}
                isSuiConnected={isSuiConnected}
                suiAddress={suiAddress}
                connectSui={connectSui}
                disconnectSui={disconnectSui}
              />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}
