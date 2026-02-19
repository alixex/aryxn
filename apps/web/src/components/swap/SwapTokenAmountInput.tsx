import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type DexTokenOption = {
  value: string
  label: string
  subtitle?: string
  badge?: string
}

type SwapTokenAmountInputProps = {
  tokenValue: string
  onTokenChange: (value: string) => void
  tokenOptions: DexTokenOption[]
  amountValue: string
  onAmountChange?: (value: string) => void
  amountPlaceholder?: string
  amountType?: "text" | "number"
  amountInputMode?: "decimal" | "numeric"
  amountReadOnly?: boolean
  amountAriaLabel?: string
  className?: string
  amountClassName?: string
  tokenTriggerClassName?: string
}

export function SwapTokenAmountInput({
  tokenValue,
  onTokenChange,
  tokenOptions,
  amountValue,
  onAmountChange,
  amountPlaceholder = "0.0",
  amountType = "text",
  amountInputMode = "decimal",
  amountReadOnly = false,
  amountAriaLabel,
  className,
  amountClassName,
  tokenTriggerClassName,
}: SwapTokenAmountInputProps) {
  return (
    <div
      className={cn(
        "border-border bg-background focus-within:border-ring focus-within:ring-ring/10 flex items-center gap-3 rounded-xl border-2 p-4 shadow-sm transition-all focus-within:ring-2",
        className,
      )}
    >
      <Select value={tokenValue} onValueChange={onTokenChange}>
        <SelectTrigger
          className={cn(
            "bg-secondary hover:bg-accent w-28 shrink-0 justify-center border-none px-3 py-2.5 font-bold shadow-none transition-colors",
            tokenTriggerClassName,
          )}
        >
          <SelectValue>
            <span className="text-base">{tokenValue}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {tokenOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-bold">{option.label}</span>
                {option.badge && (
                  <span className="text-muted-foreground text-xs uppercase">
                    {option.badge}
                  </span>
                )}
              </div>
              {option.subtitle && (
                <div className="text-muted-foreground text-xs">
                  {option.subtitle}
                </div>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="bg-border h-10 w-px"></div>
      <Input
        type={amountType}
        inputMode={amountInputMode}
        placeholder={amountPlaceholder}
        value={amountValue}
        onChange={onAmountChange ? (e) => onAmountChange(e.target.value) : undefined}
        readOnly={amountReadOnly}
        autoComplete="off"
        aria-label={amountAriaLabel}
        className={cn(
          "min-w-0 flex-1 [appearance:textfield] border-none bg-transparent px-2 text-right text-xl font-bold shadow-none focus-visible:ring-0 sm:text-2xl",
          amountReadOnly && "cursor-default",
          amountClassName,
        )}
      />
    </div>
  )
}
