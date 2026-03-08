import { useState, useCallback, useRef, useEffect } from "react"
import { Search, X, ExternalLink, Loader2, Lock, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  searchArweaveTransactions,
  type ArweaveSearchResult,
} from "@/lib/storage"
import {
  useTranslation,
  isSimplifiedChinese,
  isTraditionalChinese,
} from "@/i18n/config"
import i18n from "@/i18n/config"
import { useWallet } from "@/hooks/account-hooks"

export function ArweaveSearch() {
  const { t } = useTranslation()
  const wallet = useWallet()
  const activeAddress = wallet.internal.activeAddress
  const [query, setQuery] = useState("")
  const [networkFilter, setNetworkFilter] = useState<
    "all" | "irys" | "arweave"
  >("all")
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<ArweaveSearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Keyboard shortcuts: "/" or "Cmd+K" to focus
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if already typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    setShowResults(true)

    try {
      const searchResults = await searchArweaveTransactions({
        query: query.trim(),
        limit: 20,
        ownerAddress: activeAddress || undefined,
        preferLocal: true, // 优先本地搜索
        networkFilter,
      })
      setResults(searchResults)
    } catch (error) {
      console.error("Search failed:", error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [query, activeAddress, networkFilter])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSearch()
      } else if (e.key === "Escape") {
        setShowResults(false)
        inputRef.current?.blur()
      }
    },
    [handleSearch],
  )

  const handleClear = useCallback(() => {
    setQuery("")
    setResults([])
    setShowResults(false)
    inputRef.current?.focus()
  }, [])

  const formatDate = (timestamp: number) => {
    const currentLang = i18n.language
    let locale = "en-US"
    if (isSimplifiedChinese(currentLang)) {
      locale = "zh-CN"
    } else if (isTraditionalChinese(currentLang)) {
      locale = "zh-HK"
    }
    return new Date(timestamp * 1000).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes, 10)
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
    if (size < 1024 * 1024 * 1024)
      return `${(size / (1024 * 1024)).toFixed(2)} MB`
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const getTagValue = (
    tags: Array<{ name: string; value: string }>,
    name: string,
  ) => {
    return tags.find((tag) => tag.name === name)?.value || ""
  }

  const shortenedTxId = (txId: string) => {
    return `${txId.slice(0, 8)}...${txId.slice(-8)}`
  }

  return (
    <div ref={searchRef} className="relative w-full lg:max-w-md lg:flex-1">
      <div className="flex items-center gap-2">
        <select
          value={networkFilter}
          onChange={(e) =>
            setNetworkFilter(e.target.value as "all" | "irys" | "arweave")
          }
          className="border-border bg-card text-foreground focus-visible:border-ring focus-visible:ring-ring/20 h-9 shrink-0 appearance-none rounded-md border pr-8 pl-2.5 text-xs font-semibold focus:ring-1 focus:outline-none sm:h-10 sm:text-sm"
          style={{ backgroundPosition: "right 0.5rem center" }}
        >
          <option value="all">{t("search.allNetworks", "All Networks")}</option>
          <option value="irys">{t("search.irysOnly", "Irys L1 Fast")}</option>
          <option value="arweave">
            {t("search.arweaveOnly", "Arweave L1")}
          </option>
        </select>

        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            placeholder={`${t("common.searchArweave")} (Cmd+K)`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) {
                setShowResults(true)
              }
            }}
            className="border-border bg-card focus-visible:border-ring focus-visible:ring-ring/20 w-full pr-20 text-sm focus-visible:ring-1 sm:pr-24 sm:text-base"
          />
          {query && (
            <button
              onClick={handleClear}
              className="text-muted-foreground hover:bg-accent hover:text-foreground active:bg-muted absolute top-1/2 right-10 -translate-y-1/2 rounded p-1 transition-colors sm:right-14"
              aria-label={t("common.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 disabled:hover:bg-primary absolute top-1/2 right-1 h-8 -translate-y-1/2 rounded-md px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
            aria-label={t("common.searchButton")}
          >
            {isSearching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
          </button>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="text-muted-foreground hover:bg-accent hover:text-foreground active:bg-muted flex h-8 shrink-0 items-center justify-center rounded-md p-1.5 transition-colors sm:h-9 sm:p-2"
              aria-label={t("common.searchCapabilities")}
            >
              <Info className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogTitle className="text-lg font-semibold">
              {t("common.searchCapabilities")}
            </DialogTitle>
            <div className="text-muted-foreground space-y-2 text-sm">
              <pre className="font-sans whitespace-pre-wrap">
                {t("common.searchCapabilitiesDesc")}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索结果下拉框 */}
      {showResults && (
        <Card className="border-border bg-card absolute top-full right-0 left-0 z-50 mt-2 max-h-[60vh] w-full overflow-y-auto border shadow-xl sm:max-h-96">
          {isSearching ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              <span className="text-muted-foreground ml-2 text-sm">
                {t("common.searching")}
              </span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              {query.trim()
                ? t("common.noResults")
                : t("common.enterSearchQuery")}
            </div>
          ) : (
            <div className="divide-y">
              {results.map((result) => {
                const fileName = getTagValue(result.tags, "File-Name")
                const contentType = getTagValue(result.tags, "Content-Type")
                const appName = getTagValue(result.tags, "App-Name")
                const description = getTagValue(result.tags, "Description")
                const encryptionAlgo = getTagValue(
                  result.tags,
                  "Encryption-Algo",
                )
                const storageNetwork = getTagValue(
                  result.tags,
                  "Storage-Network",
                )
                const isEncrypted = encryptionAlgo && encryptionAlgo !== "none"
                const isIrys = storageNetwork?.toLowerCase() === "irys"
                const gatewayUrl = isIrys
                  ? `https://gateway.irys.xyz/${result.id}`
                  : `https://arweave.net/${result.id}`

                return (
                  <a
                    key={result.id}
                    href={gatewayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-accent active:bg-muted block p-3 transition-colors sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {fileName && (
                          <div className="text-foreground flex items-center gap-2 truncate text-sm font-medium sm:text-base">
                            <span className="truncate">{fileName}</span>
                            {isEncrypted && (
                              <span
                                className="bg-secondary text-foreground flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                                title={t("common.encrypted")}
                              >
                                <Lock className="h-3 w-3" />
                                <span className="hidden sm:inline">
                                  {t("common.encrypted")}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                        {description && (
                          <div className="text-muted-foreground mt-1 truncate text-xs sm:text-sm">
                            {description}
                          </div>
                        )}
                        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1.5 text-xs sm:gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-semibold sm:px-2 ${
                              isIrys
                                ? "bg-purple-100/50 text-purple-700 ring-1 ring-purple-500/30"
                                : "bg-orange-100/50 text-orange-700 ring-1 ring-orange-500/30"
                            }`}
                          >
                            {isIrys ? "Irys L1" : "Arweave"}
                          </span>
                          {appName && (
                            <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs sm:px-2">
                              {appName}
                            </span>
                          )}
                          {contentType && (
                            <span className="bg-secondary rounded px-1.5 py-0.5 text-xs sm:px-2">
                              {contentType}
                            </span>
                          )}
                          <span className="whitespace-nowrap">
                            {formatFileSize(result.data.size)}
                          </span>
                          {result.block?.timestamp && (
                            <span className="whitespace-nowrap">
                              {formatDate(result.block.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground mt-1 font-mono text-xs break-all sm:break-normal">
                          {shortenedTxId(result.id)}
                        </div>
                      </div>
                      <ExternalLink className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
