import { useState, useCallback, useRef, useEffect } from "react"
import { Search, X, ExternalLink, Loader2, Lock, Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  searchArweaveTransactions,
  type ArweaveSearchResult,
} from "@/lib/arweave-search"
import { useTranslation, isSimplifiedChinese } from "@/i18n/config"
import i18n from "@/i18n/config"
import { useWallet } from "@/hooks/account-hooks"

interface MobileSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSearchDialog({
  open,
  onOpenChange,
}: MobileSearchDialogProps) {
  const { t } = useTranslation()
  const wallet = useWallet()
  const activeAddress = wallet.internal.activeAddress
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<ArweaveSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 打开对话框时聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      setQuery("")
      setResults([])
      setHasSearched(false)
      setSearchError(null)
    }
  }, [open])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    setHasSearched(true)
    setSearchError(null)

    try {
      console.log("Searching for:", query.trim())
      const searchResults = await searchArweaveTransactions({
        query: query.trim(),
        limit: 20,
        ownerAddress: activeAddress || undefined,
        preferLocal: true, // 优先本地搜索
      })
      console.log(`Search completed: found ${searchResults.length} results`)
      setResults(searchResults)
      if (searchResults.length === 0) {
        setSearchError(null) // 没有结果不是错误
        console.log("No results found. This might be because:")
        console.log("1. The keyword is not in recent transactions")
        console.log("2. The keyword doesn't match any tag values")
        console.log(
          "3. Try searching for file names, app names, or transaction IDs",
        )
      }
    } catch (error) {
      console.error("Search failed:", error)
      setResults([])
      setSearchError(
        error instanceof Error ? error.message : t("common.searchError"),
      )
    } finally {
      setIsSearching(false)
    }
  }, [query, activeAddress])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSearch()
      }
    },
    [handleSearch],
  )

  const handleClear = useCallback(() => {
    setQuery("")
    setResults([])
    setHasSearched(false)
    inputRef.current?.focus()
  }, [])

  const formatDate = (timestamp: number) => {
    const locale = isSimplifiedChinese(i18n.language) ? "zh-CN" : "en-US"
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[5vh] flex max-h-[90vh] translate-y-0 flex-col gap-0 rounded-3xl border-0 p-0 shadow-2xl sm:top-[50%] sm:max-w-lg sm:translate-y-[-50%] sm:rounded-3xl [&>button]:hidden">
        {/* 隐藏的标题，用于屏幕阅读器可访问性 */}
        <DialogTitle className="sr-only">
          {t("common.searchArweave")}
        </DialogTitle>

        {/* 搜索框区域 - 固定在顶部 */}
        <div className="border-border bg-card/95 sticky top-0 z-10 rounded-t-3xl border-b px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6 sm:py-5 lg:px-8 lg:py-5">
          {/* 标题栏：关闭按钮 - 仅移动端显示 */}
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <h2 className="text-foreground text-lg font-semibold">
              {t("common.searchTitle")}
            </h2>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:bg-accent hover:text-foreground active:bg-muted rounded-full p-2 transition-all"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 搜索框容器 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2" />
              <Input
                ref={inputRef}
                type="text"
                placeholder={t("common.searchArweave")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="border-border bg-card focus-visible:border-ring focus-visible:bg-card focus-visible:ring-ring/20 h-12 w-full rounded-xl border-2 pr-20 pl-12 text-base shadow-sm transition-all focus-visible:ring-1 sm:h-14 sm:rounded-2xl sm:pr-24 md:pr-28 lg:pr-24"
              />
              {/* 清除按钮 */}
              {query && (
                <button
                  onClick={handleClear}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground active:bg-muted absolute top-1/2 right-10 z-10 -translate-y-1/2 rounded-full p-1.5 transition-all sm:right-14 sm:p-2 md:right-18 lg:right-14"
                  aria-label={t("common.clearSearch")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {/* 搜索按钮 */}
              <button
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:hover:bg-primary absolute top-1/2 right-1.5 z-10 flex h-9 min-w-10 -translate-y-1/2 items-center justify-center rounded-lg px-3 text-xs font-semibold shadow-sm transition-all hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:right-2 sm:h-10 sm:min-w-14 sm:rounded-xl sm:px-4 sm:text-sm md:right-2 md:px-5 lg:right-2"
                aria-label={t("common.searchButton")}
              >
                {isSearching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                ) : (
                  <>
                    <Search className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline">
                      {t("common.searchButton")}
                    </span>
                  </>
                )}
              </button>
            </div>
            {/* 搜索功能说明 */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="text-muted-foreground hover:bg-accent hover:text-foreground active:bg-muted flex h-12 shrink-0 items-center justify-center rounded-xl p-2.5 transition-all sm:h-14 sm:rounded-2xl sm:p-3"
                  aria-label={t("common.searchCapabilities")}
                >
                  <Info className="h-5 w-5 sm:h-6 sm:w-6" />
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

          {/* 桌面端关闭按钮 - lg 及以上显示 */}
          <button
            onClick={() => onOpenChange(false)}
            className="border-border bg-card/80 text-foreground hover:bg-card hover:text-foreground active:bg-muted z-20 hidden rounded-full border p-2 shadow-md backdrop-blur-sm transition-all hover:shadow-lg lg:absolute lg:top-5 lg:right-8 lg:block"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 搜索结果区域 */}
        <div className="bg-background flex-1 overflow-y-auto rounded-b-3xl">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
              <div className="relative">
                <div className="bg-secondary absolute inset-0 animate-ping rounded-full opacity-75"></div>
                <div className="bg-secondary/50 relative rounded-full p-4">
                  <Loader2 className="text-foreground h-8 w-8 animate-spin" />
                </div>
              </div>
              <span className="text-foreground mt-6 text-sm font-medium">
                {t("common.searching")}
              </span>
              <span className="text-muted-foreground mt-2 text-xs">
                {t("common.searchingArweaveTransactions")}
              </span>
            </div>
          ) : searchError ? (
            <div className="flex flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
              <div className="relative mb-6">
                <div className="bg-destructive/20 absolute inset-0 rounded-full opacity-50 blur-xl"></div>
                <div className="bg-destructive/10 relative rounded-2xl p-6 shadow-inner">
                  <X className="text-destructive/70 h-8 w-8" />
                </div>
              </div>
              <p className="text-foreground text-base font-semibold">
                {t("common.searchError")}
              </p>
              <p className="text-muted-foreground mt-2 max-w-xs text-center text-sm">
                {searchError}
              </p>
              <p className="text-muted-foreground mt-4 max-w-xs text-center text-xs">
                {t("common.searchErrorHint")}
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
              <div className="relative mb-6">
                <div className="bg-secondary absolute inset-0 rounded-full opacity-50 blur-xl"></div>
                <div className="bg-secondary relative rounded-2xl p-6 shadow-inner">
                  <Search className="text-muted-foreground h-8 w-8" />
                </div>
              </div>
              <p className="text-foreground text-base font-semibold">
                {hasSearched && query.trim()
                  ? t("common.noResults")
                  : t("common.enterSearchQuery")}
              </p>
              {hasSearched && query.trim() ? (
                <>
                  <p className="text-muted-foreground mt-2 max-w-xs text-center text-sm">
                    {t("common.tryDifferentKeywords")}
                  </p>
                  <p className="text-muted-foreground mt-4 max-w-xs text-center text-xs">
                    {t("common.searchLimitHint")}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground mt-2 max-w-xs text-center text-sm">
                  {t("common.enterFileNameOrKeywords")}
                </p>
              )}
            </div>
          ) : (
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-5">
              <div className="mb-4 flex items-center justify-between px-2">
                <div className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {t("common.searchResults")}
                </div>
                <div className="bg-secondary text-foreground rounded-full px-3 py-1 text-xs font-semibold">
                  {results.length} {t("common.resultsCount")}
                </div>
              </div>
              <div className="space-y-3">
                {results.map((result) => {
                  const fileName = getTagValue(result.tags, "File-Name")
                  const contentType = getTagValue(result.tags, "Content-Type")
                  const appName = getTagValue(result.tags, "App-Name")
                  const description = getTagValue(result.tags, "Description")
                  const encryptionAlgo = getTagValue(
                    result.tags,
                    "Encryption-Algo",
                  )
                  const isEncrypted =
                    encryptionAlgo && encryptionAlgo !== "none"

                  return (
                    <a
                      key={result.id}
                      href={`https://arweave.net/${result.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onOpenChange(false)}
                      className="group animate-fade-in-up border-border bg-card hover:border-ring block rounded-2xl border-2 p-5 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {fileName && (
                            <div className="mb-2 flex items-center gap-2">
                              <div className="text-foreground truncate text-base leading-tight font-bold">
                                {fileName}
                              </div>
                              {isEncrypted && (
                                <span
                                  className="border-border bg-secondary text-foreground flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold"
                                  title={t("common.encrypted")}
                                >
                                  <Lock className="h-3 w-3" />
                                  <span>{t("common.encrypted")}</span>
                                </span>
                              )}
                              <ExternalLink className="text-muted-foreground h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                            </div>
                          )}
                          {description && (
                            <div className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
                              {description}
                            </div>
                          )}
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            {appName && (
                              <span className="border-border bg-secondary text-foreground inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold">
                                {appName}
                              </span>
                            )}
                            {contentType && (
                              <span className="border-border bg-secondary text-foreground inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium">
                                {contentType}
                              </span>
                            )}
                            <span className="text-muted-foreground inline-flex items-center text-xs font-medium">
                              {formatFileSize(result.data.size)}
                            </span>
                            {result.block?.timestamp && (
                              <span className="text-muted-foreground inline-flex items-center text-xs">
                                {formatDate(result.block.timestamp)}
                              </span>
                            )}
                          </div>
                          <div className="border-border mt-3 border-t pt-3">
                            <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs break-all">
                              <span className="text-foreground font-medium">
                                ID:
                              </span>
                              <span className="text-muted-foreground">
                                {shortenedTxId(result.id)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
