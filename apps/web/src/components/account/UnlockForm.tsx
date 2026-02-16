import { useState } from "react"
import { useTranslation } from "@/i18n/config"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, Eye, EyeOff, ChevronRight } from "lucide-react"

interface UnlockFormProps {
  onUnlock: (password: string) => Promise<boolean>
}

export function UnlockForm({ onUnlock }: UnlockFormProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await onUnlock(password)
    if (success) setPassword("")
  }

  return (
    <Card className="border-border overflow-hidden shadow-md">
      <div className="bg-primary h-2 w-full" />
      <CardHeader className="pt-8 text-center">
        <div className="bg-secondary mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <Lock className="text-foreground h-8 w-8" />
        </div>
        <CardTitle className="text-2xl">{t("unlock.accessTitle")}</CardTitle>
        <CardDescription className="mx-auto max-w-md text-base">
          {t("unlock.accessDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-12">
        <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder={t("unlock.passwordPlaceholder")}
              className="border-border focus-visible:ring-ring/20 h-12 rounded-xl pr-12 text-center text-lg focus-visible:ring-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 w-full rounded-xl text-lg font-bold shadow-sm"
          >
            {t("unlock.submit")} <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
