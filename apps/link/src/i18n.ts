// App i18n — built on ranui's framework-agnostic I18nCore (see memory
// [[ranui-import-system]]). Locale persists to localStorage + auto-detects from
// navigator; switching re-renders the app (wired in main.ts via onChange).

import { createI18n } from "ranui/i18n"
import { setLocale as setArweaveLocale } from "@alixex/arweave"
import { en } from "./locales/en"
import { zhCN } from "./locales/zh-CN"

export const i18n = createI18n({
  messages: { en, "zh-CN": zhCN },
  fallbackLocale: "en",
  persist: true,
  detectNavigator: true,
})

// Keep the @alixex/arweave upload-stage messages in the same locale.
const syncArweave = (loc: string): void => {
  if (loc === "en" || loc === "zh-CN") setArweaveLocale(loc)
}
syncArweave(i18n.getLocale())
i18n.onChange(syncArweave)

export const t = (
  key: string,
  params?: Record<string, string | number>,
): string => i18n.t(key, params)
