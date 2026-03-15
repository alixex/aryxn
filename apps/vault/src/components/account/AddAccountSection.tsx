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
    <Card className="border-border/70 bg-card/90 overflow-hidden rounded-[28px] border shadow-[0_14px_36px_-28px_hsl(220_35%_2%/0.48)] transition-all duration-200">
      <CardHeader className="animate-fade-in-down border-border/70 border-b bg-[hsl(var(--card)/0.95)] px-5 py-5 sm:px-6 sm:py-6">
        <CardTitle className="text-foreground flex items-center gap-3 text-lg font-semibold tracking-tight">
          <div className="border-border/60 text-foreground rounded-2xl border bg-[hsl(var(--background)/0.55)] p-2.5">
            <Plus className="h-5 w-5" />
          </div>
          {t("identities.addNew")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="border-border/60 mx-4 mt-4 grid h-auto grid-cols-2 rounded-2xl border bg-[hsl(var(--background)/0.5)] p-1.5 sm:mx-6 sm:mt-5 sm:w-fit sm:min-w-60">
            <TabsTrigger
              value="import"
              className="data-[state=active]:bg-card data-[state=active]:text-primary cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 data-[state=active]:shadow-[0_12px_28px_-18px_hsl(220_35%_2%/0.72)]"
            >
              {t("identities.import")}
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="data-[state=active]:bg-card data-[state=active]:text-primary cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 data-[state=active]:shadow-[0_12px_28px_-18px_hsl(220_35%_2%/0.72)]"
            >
              {t("identities.new")}
            </TabsTrigger>
          </TabsList>

          <div className="p-4 pt-4 sm:p-6 sm:pt-5">
            <TabsContent value="import" className="mt-0 space-y-5">
              <div className="flex flex-wrap gap-2.5">
                {chains.map((chain) => (
                  <Button
                    key={`import-${chain.id}`}
                    variant={importChain === chain.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setImportChain(chain.id)}
                    className={`h-9 gap-2 rounded-full px-3.5 text-[10px] font-bold uppercase transition-all duration-200 ${
                      importChain === chain.id
                        ? "bg-primary text-primary-foreground shadow-[0_10px_20px_-16px_hsl(var(--primary)/0.75)]"
                        : "border-border/70 text-foreground hover:border-primary/30 hover:bg-accent/50 bg-[hsl(var(--background)/0.5)]"
                    }`}
                  >
                    <div className="scale-75">{chain.icon}</div>
                    {chain.name}
                  </Button>
                ))}
              </div>

              <form
                onSubmit={handleSubmit}
                className="border-border/60 space-y-4 rounded-3xl border bg-[hsl(var(--background)/0.5)] p-4 sm:p-5"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-foreground text-xs font-semibold tracking-wide">
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
                    <label className="text-foreground text-xs font-semibold tracking-wide">
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
                        className="text-muted-foreground hover:text-primary absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-full p-1 transition-colors"
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
                  className="bg-primary text-primary-foreground h-11 w-full rounded-xl font-semibold shadow-[0_10px_20px_-16px_hsl(var(--primary)/0.75)] transition-all duration-200 hover:-translate-y-0.5"
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
                    className="group border-border/70 hover:border-primary/35 hover:bg-accent/40 flex h-24 cursor-pointer flex-col gap-2 rounded-2xl border bg-[hsl(var(--background)/0.56)] transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <div className="border-border/50 text-foreground group-hover:border-primary/20 group-hover:bg-accent/70 rounded-2xl border bg-[hsl(var(--background)/0.7)] p-2 transition-colors">
                      {chain.icon}
                    </div>
                    <span className="text-foreground text-[11px] font-semibold tracking-wide">
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
