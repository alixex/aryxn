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
    <Card className="border-border/90 bg-card/84 border shadow-[0_16px_30px_-20px_hsl(220_35%_2%/0.72)] transition-all duration-200">
      <CardHeader className="animate-fade-in-down border-border/85 bg-card/92 rounded-t-2xl border-b p-6">
        <CardTitle className="text-foreground flex items-center gap-3 text-base font-semibold">
          <div className="bg-muted text-foreground rounded-lg p-2">
            <Plus className="h-5 w-5" />
          </div>
          {t("identities.addNew")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="bg-accent/20 mx-6 mt-6 mb-2 h-auto w-auto rounded-xl p-1.5">
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
                        ? "bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-accent"
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
                  className="bg-primary text-primary-foreground h-10 w-full rounded-lg font-semibold shadow-[0_10px_20px_-16px_hsl(220_35%_2%/0.72)] hover:-translate-y-0.5"
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
                    className="border-border bg-[hsl(var(--background)/0.55)] hover:bg-accent/40 group flex h-20 flex-col gap-1.5 rounded-lg transition-all hover:-translate-y-0.5 hover:border-primary/35"
                  >
                    <div className="bg-muted text-foreground group-hover:bg-accent rounded-lg p-1.5 transition-colors">
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
