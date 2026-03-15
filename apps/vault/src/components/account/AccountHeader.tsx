import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  t: any
  isUnlocked: boolean
  onLogout: () => void
}

export default function AccountHeader({ t, isUnlocked, onLogout }: Props) {
  return (
    <div className="border-border/70 relative overflow-hidden rounded-4xl border bg-[linear-gradient(135deg,hsl(var(--card))_0%,hsl(var(--card)/0.9)_60%,hsl(var(--accent)/0.08)_100%)] px-5 py-6 shadow-[0_16px_42px_-34px_hsl(220_35%_2%/0.55)] sm:px-7 sm:py-8">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_right,hsl(var(--primary)/0.12),transparent_66%)] lg:block" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-3">
          <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.34em] uppercase">
            {t("identities.activeVault")}
          </div>
          <h2 className="flex items-center gap-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            <div className="bg-primary/85 text-primary-foreground ring-border/70 rounded-[22px] p-3 ring-1">
              <svg
                className="h-7 w-7 sm:h-8 sm:w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="leading-tight text-[hsl(var(--foreground))]">
              {t("common.account")}
            </span>
          </h2>
          <p className="max-w-2xl text-sm leading-7 font-medium text-[hsl(var(--foreground)/0.7)] sm:text-base">
            {t("identities.multiChainDesc")}
          </p>
        </div>
        {isUnlocked && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="border-destructive/25 text-destructive hover:border-destructive/50 hover:bg-destructive/10 bg-[hsl(var(--background)/0.55)] transition-all duration-200 cursor-pointer lg:self-start"
          >
            <LogOut className="mr-2 h-4 w-4" /> {t("identities.logout")}
          </Button>
        )}
      </div>
    </div>
  )
}
