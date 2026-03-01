import { type ReactNode } from "react"
import { Navbar } from "./Navbar"
import { useTranslation } from "@/i18n/config"
import { Toaster } from "sonner"

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="bg-background text-foreground bg-gradient-radial min-h-screen pb-20 font-sans transition-colors duration-300 md:pb-0">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 py-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <footer className="border-border/30 bg-card/20 glass-strong mt-auto border-t py-8 backdrop-blur-md">
        <div className="text-muted-foreground container mx-auto max-w-6xl px-4 text-center text-sm font-medium lg:px-8">
          <p>{t("common.footer")}</p>
        </div>
      </footer>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
