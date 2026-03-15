import { type ReactNode } from "react"
import { Navbar } from "./Navbar"
import { useTranslation } from "@/i18n/config"
import { Toaster } from "sonner"

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="bg-background text-foreground bg-gradient-radial relative min-h-screen overflow-x-clip pb-[5.35rem] transition-colors duration-300 md:pb-0">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-24 -left-28 h-72 w-72 rounded-full bg-[hsl(var(--accent)/0.16)] blur-3xl" />
        <div className="absolute top-12 right-0 h-80 w-80 rounded-full bg-[hsl(var(--secondary)/0.14)] blur-3xl" />
      </div>
      <Navbar />
      <main className="relative z-10 container mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8 lg:px-8">
        {children}
      </main>
      <footer className="glass-strong border-border/60 relative z-10 mt-auto border-t py-8 backdrop-blur-md">
        <div className="text-muted-foreground container mx-auto max-w-6xl px-4 text-center text-sm font-medium lg:px-8">
          <p>{t("common.footer")}</p>
        </div>
      </footer>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
