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
  PolygonIcon,
  BscIcon,
  AvalancheIcon,
} from "@/components/icons"

interface AddAccountSectionProps {
  onAddAccount: (input: string, alias: string, chain?: string) => Promise<void>
  onCreateAccount: (chain: string) => Promise<void>
}

export function AddAccountSection({
  onAddAccount,
  onCreateAccount,
}: AddAccountSectionProps) {
  const { t } = useTranslation()
  const [newAccountInput, setNewAccountInput] = useState("")
  const [newAccountAlias, setNewAccountAlias] = useState("")
  const [showImportKey, setShowImportKey] = useState(false)
  const [importChain, setImportChain] = useState("ethereum")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAccountInput || !newAccountAlias) {
      return
    }
    await onAddAccount(newAccountInput, newAccountAlias, importChain)
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
      id: "arweave",
      name: "Arweave",
      icon: <ArweaveIcon className="h-5 w-5" />,
    },
    { id: "solana", name: "Solana", icon: <SolanaIcon className="h-5 w-5" /> },
    { id: "sui", name: "Sui", icon: <SuiIcon className="h-5 w-5" /> },
    {
      id: "polygon",
      name: "Polygon",
      icon: <PolygonIcon className="h-5 w-5" />,
    },
    {
      id: "bsc",
      name: "BSC",
      icon: <BscIcon className="h-5 w-5" />,
    },
    {
      id: "avalanche",
      name: "Avalanche",
      icon: <AvalancheIcon className="h-5 w-5" />,
    },
    {
      id: "bitcoin",
      name: "Bitcoin",
      icon: <BitcoinIcon className="h-5 w-5" />,
    },
  ]

  return (
    <Card className="glass-premium hover:shadow-primary/5 border-none shadow-2xl transition-all duration-500">
      <CardHeader className="glass-strong animate-fade-in-down border-accent/30 bg-card/60 rounded-t-2xl border-b-2 p-6 shadow-lg">
        <CardTitle className="text-foreground flex items-center gap-3 text-base font-bold">
          <div className="rounded-lg bg-[hsl(var(--secondary)/0.2)] p-2 text-[hsl(var(--secondary))]">
            <Plus className="h-5 w-5" />
          </div>
          {t("identities.addNew")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="bg-accent/10 mx-6 mt-6 mb-2 h-auto w-auto rounded-xl p-1.5 shadow-inner">
            <TabsTrigger
              value="import"
              className="data-[state=active]:bg-card rounded-md px-4 py-2 text-xs font-semibold data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              {t("identities.import")}
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="data-[state=active]:bg-card rounded-md px-4 py-2 text-xs font-semibold data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              {t("identities.new")}
            </TabsTrigger>
          </TabsList>

          <div className="p-6 pt-4">
            <TabsContent value="import" className="mt-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                {chains.map((chain) => (
                  <Button
                    key={`import-${chain.id}`}
                    variant={importChain === chain.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setImportChain(chain.id)}
                    className={`h-8 gap-1.5 rounded-full px-3 text-[10px] font-bold uppercase transition-all ${
                      importChain === chain.id
                        ? "bg-gradient-primary text-primary-foreground"
                        : "border-primary/35 text-primary hover:bg-primary/10"
                    }`}
                  >
                    <div className="scale-75">{chain.icon}</div>
                    {chain.name}
                  </Button>
                ))}
              </div>

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
                        className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors hover:text-primary"
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
                  className="bg-gradient-primary text-primary-foreground h-10 w-full rounded-lg font-semibold shadow-[0_10px_22px_-14px_hsl(var(--primary)/0.72)] hover:-translate-y-0.5 hover:shadow-[0_14px_24px_-12px_hsl(var(--primary)/0.75)]"
                >
                  {t("identities.addSubmit")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="create" className="mt-0">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {chains.map((chain) => (
                  <Button
                    key={chain.id}
                    variant="outline"
                    onClick={() => onCreateAccount(chain.id)}
                    className="border-border bg-[hsl(var(--background)/0.5)] hover:bg-accent/30 group flex h-20 flex-col gap-1.5 rounded-lg shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5)] transition-all hover:-translate-y-0.5 hover:border-primary/50"
                  >
                    <div className="bg-[hsl(var(--secondary)/0.2)] text-[hsl(var(--secondary))] group-hover:bg-[hsl(var(--secondary)/0.26)] rounded-lg p-1.5 transition-colors">
                      {chain.icon}
                    </div>
                    <span className="text-foreground text-[10px] font-semibold">
                      {chain.name}
                    </span>
                  </Button>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  )
}
