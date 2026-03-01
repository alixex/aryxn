import i18n from "i18next"
import {
  initReactI18next,
  type UseTranslationOptions,
  useTranslation as useAppTranslation,
} from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import en from "./locales/en.json"
import zh from "./locales/zh.json"
import zhHK from "./locales/zh-HK.json"

/**
 * 支持的语言代码枚举
 */
export const SUPPORTED_LANGUAGES = {
  EN: "en",
  ZH: "zh",
  ZH_HK: "zh-HK",
} as const

/**
 * 支持的语言代码类型
 */
export type SupportedLanguage =
  (typeof SUPPORTED_LANGUAGES)[keyof typeof SUPPORTED_LANGUAGES]

/**
 * 支持的语言代码数组
 */
export const SUPPORTED_LANGUAGE_CODES: SupportedLanguage[] = [
  SUPPORTED_LANGUAGES.EN,
  SUPPORTED_LANGUAGES.ZH,
  SUPPORTED_LANGUAGES.ZH_HK,
]

/**
 * 检查语言代码是否为中文（简体或繁体）
 */
export function isChineseLanguage(lang: string): boolean {
  return lang === SUPPORTED_LANGUAGES.ZH || lang === SUPPORTED_LANGUAGES.ZH_HK
}

/**
 * 检查语言代码是否为简体中文
 */
export function isSimplifiedChinese(lang: string): boolean {
  return lang === SUPPORTED_LANGUAGES.ZH
}

/**
 * 检查语言代码是否为繁体中文
 */
export function isTraditionalChinese(lang: string): boolean {
  return lang === SUPPORTED_LANGUAGES.ZH_HK
}

const resources = {
  [SUPPORTED_LANGUAGES.EN]: { translation: en },
  [SUPPORTED_LANGUAGES.ZH]: { translation: zh },
  [SUPPORTED_LANGUAGES.ZH_HK]: { translation: zhHK },
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: SUPPORTED_LANGUAGES.EN,
    supportedLngs: SUPPORTED_LANGUAGE_CODES,
    interpolation: {
      escapeValue: false,
    },
  })

export const useTranslation = (props: UseTranslationOptions<undefined> = {}) =>
  useAppTranslation("translation", {
    ...props,
    i18n,
  })

export const t = i18n.t.bind(i18n)

export default i18n

declare module "i18next" {
  interface CustomTypeOptions {
    resources: (typeof resources)["zh"]
  }
}
