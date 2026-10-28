import en from "../app/i18n/en.json" with { type: "json" }
import es from "../app/i18n/es.json" with { type: "json" }

const CATALOGS = { en, es } as const

// Looks up a dotted key ("cli.started") and fills {placeholders}; the CLI shares the app's catalogs.
export function t(
  language: "en" | "es",
  key: string,
  vars: Record<string, string | number> = {},
): string {
  let value: unknown = CATALOGS[language]
  for (const part of key.split(".")) value = (value as Record<string, unknown> | undefined)?.[part]
  if (typeof value !== "string") return key
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}
