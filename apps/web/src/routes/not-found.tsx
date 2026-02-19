import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/i18n/config"
import { Compass } from "lucide-react"
import { Link } from "react-router-dom"

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <AppLayout>
      <div className="flex min-h-[65vh] items-center justify-center px-4">
        <Card className="border-border/50 bg-card/40 w-full max-w-xl shadow-xl backdrop-blur-sm">
          <CardHeader className="pt-8 text-center">
            <div className="from-primary/15 to-secondary/15 ring-primary/30 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ring-1">
              <Compass className="text-primary h-8 w-8" />
            </div>
            <CardTitle className="text-3xl">{t("notFound.code")}</CardTitle>
            <CardDescription className="mx-auto max-w-md text-base">
              {t("notFound.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button asChild size="lg">
              <Link to="/">{t("notFound.goHome")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
