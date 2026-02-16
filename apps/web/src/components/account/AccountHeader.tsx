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
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("common.account")}
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
          className="border-destructive/30 text-destructive hover:bg-destructive/10 w-full sm:w-auto"
        >
          <LogOut className="mr-2 h-4 w-4" /> {t("identities.logout")}
        </Button>
      )}
    </div>
  )
}
