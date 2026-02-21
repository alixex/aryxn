import { useTranslation } from "@/i18n/config"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, AlertCircle, Clock, Zap } from "lucide-react"
import type { LiFiRoute } from "@/lib/bridge/route-types"

interface BridgePreviewProps {
  route: LiFiRoute | null
  loading?: boolean
  error?: string
}

function formatAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount) / Math.pow(10, decimals)
  return num.toFixed(Math.min(decimals, 6))
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  return `${Math.ceil(seconds / 3600)}h`
}

function parseFeeValue(value?: string): number {
  if (!value) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function BridgePreview({ route, loading, error }: BridgePreviewProps) {
  const { t } = useTranslation()

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-destructive text-sm font-medium">
                {t("common.error")}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="bg-secondary">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="bg-muted w-half h-4 rounded" />
            <div className="bg-muted h-4 w-2/3 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!route) {
    return null
  }

  const timeFormatted = formatTime(route.estimate.duration)
  const feeItems = [
    {
      label: t("bridge.bridgeFee"),
      value: parseFeeValue(route.fees.breakdown.bridge),
    },
    {
      label: t("bridge.swapFee"),
      value: parseFeeValue(route.fees.breakdown.swap),
    },
    {
      label: t("bridge.lifiFee"),
      value: parseFeeValue(route.fees.breakdown.lifi),
    },
  ].filter((item) => item.value > 0)

  const riskHints = [
    route.fees.percentage >= 1 ? t("bridge.riskHighFee") : null,
    route.estimate.duration > 1800 ? t("bridge.riskSlow") : null,
    route.steps.length > 2 ? t("bridge.riskMultiStep") : null,
  ].filter(Boolean) as string[]

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Route summary */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{route.fromToken.symbol}</span>
              <ArrowRight className="text-muted-foreground h-4 w-4" />
              <span className="font-medium">{route.toToken.symbol}</span>
            </div>
            <span className="text-muted-foreground">
              {route.steps.length}{" "}
              {route.steps.length === 1 ? t("bridge.step") : t("bridge.steps")}
            </span>
          </div>

          {/* Amount and rate */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground text-xs">
                {t("bridge.youGet")}
              </p>
              <p className="text-sm font-semibold">
                {formatAmount(route.toAmount, route.toToken.decimals)}{" "}
                {route.toToken.symbol}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">
                {t("bridge.rate")}
              </p>
              <p className="text-sm font-semibold">
                1 {route.fromToken.symbol} ={" "}
                {(Number(route.toAmount) / Number(route.fromAmount)).toFixed(4)}{" "}
                {route.toToken.symbol}
              </p>
            </div>
          </div>

          {/* Fees and time */}
          <div className="border-primary/10 flex gap-4 border-t pt-2">
            <div className="flex-1">
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Zap className="h-3 w-3" />
                <span>{t("bridge.fee")}</span>
              </div>
              <p className="text-sm font-medium">
                {route.fees.percentage.toFixed(2)}%
              </p>
            </div>
            <div className="flex-1">
              <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                <span>{t("bridge.time")}</span>
              </div>
              <p className="text-sm font-medium">~{timeFormatted}</p>
            </div>
          </div>

          {/* Bridge provider */}
          <div className="text-muted-foreground pt-2 text-xs">
            <span>{t("bridge.via")} </span>
            <span className="text-foreground font-medium">
              {route.steps[0]?.tool || t("bridge.providerFallback")}
            </span>
          </div>

          <div className="border-primary/10 space-y-1 border-t pt-2 text-xs">
            <div className="text-muted-foreground">
              {t("bridge.feeBreakdown")}
            </div>
            {feeItems.length > 0 ? (
              feeItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                >
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">
                    {item.value.toFixed(6)} {route.toToken.symbol}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">
                {t("bridge.breakdownUnavailable")}
              </div>
            )}
          </div>

          {riskHints.length > 0 && (
            <div className="border-muted rounded-md border p-2 text-xs">
              <div className="mb-1 font-medium">{t("bridge.riskTitle")}</div>
              <div className="text-muted-foreground">
                {riskHints.join(" · ")}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
