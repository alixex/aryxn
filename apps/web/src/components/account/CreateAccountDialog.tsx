import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/i18n/config"

interface CreateAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chain: string
  onConfirm: (alias: string) => void
}

export function CreateAccountDialog({
  open,
  onOpenChange,
  chain,
  onConfirm,
}: CreateAccountDialogProps) {
  const { t } = useTranslation()
  const [alias, setAlias] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!alias.trim()) {
      setError(t("identities.aliasRequired", "Account name is required"))
      return
    }

    if (alias.length > 50) {
      setError(
        t(
          "identities.aliasTooLong",
          "Account name must be less than 50 characters",
        ),
      )
      return
    }

    onConfirm(alias.trim())
    setAlias("")
    setError("")
    onOpenChange(false)
  }

  const handleCancel = () => {
    setAlias("")
    setError("")
    onOpenChange(false)
  }

  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setAlias(`${chain.toUpperCase()}-Account`)
      setError("")
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {t("identities.createAccountTitle", "Create New Account")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "identities.createAccountDesc",
                "Enter a name for your new {{chain}} account",
                { chain: chain.toUpperCase() },
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="alias">
                {t("identities.accountName", "Account Name")}
              </Label>
              <Input
                id="alias"
                value={alias}
                onChange={(e) => {
                  setAlias(e.target.value)
                  setError("")
                }}
                placeholder={t(
                  "identities.accountNamePlaceholder",
                  "Enter account name",
                )}
                autoFocus
                maxLength={50}
                aria-invalid={!!error}
                aria-describedby={error ? "alias-error" : undefined}
              />
              {error && (
                <p
                  id="alias-error"
                  className="text-destructive text-sm"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="sm:mr-2"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="submit">
              {t("identities.createButton", "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
