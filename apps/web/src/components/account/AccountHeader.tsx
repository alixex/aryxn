import React from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  t: any
  isUnlocked: boolean
  onLogout: () => void
}

export default function AccountHeader({ t, isUnlocked, onLogout }: Props) {
  return (
    <div className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-0">
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-3 text-4xl font-extrabold tracking-tighter sm:text-5xl">
          <div className="bg-gradient-primary glow-purple rounded-2xl p-2.5 text-white shadow-xl ring-1 ring-white/20">
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
          <span className="bg-gradient-primary gradient-text leading-tight">
            {t("common.account")}
          </span>
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t("identities.multiChainDesc")}
        </p>
      </div>
      {isUnlocked && (
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 w-full transition-all sm:w-auto"
        >
          <LogOut className="mr-2 h-4 w-4" /> {t("identities.logout")}
        </Button>
      )}
    </div>
  )
}
