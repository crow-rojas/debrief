import { createI18n } from "vue-i18n"
import en from "./en.json"
import es from "./es.json"

export function makeI18n(locale = navigator.language.startsWith("es") ? "es" : "en") {
  return createI18n({ legacy: false, locale, fallbackLocale: "en", messages: { en, es } })
}
