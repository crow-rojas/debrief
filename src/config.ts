import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { homePath } from "./paths.ts"

export type Config = {
  language: "en" | "es"
  dailyNewCards: number
  port: number
  generator: unknown
  repos: Record<string, { research: boolean }>
  exclude: string[]
  lan: boolean
}

const DEFAULTS: Config = {
  language: "en",
  dailyNewCards: 10,
  port: 47821,
  generator: "auto",
  repos: {},
  exclude: [],
  lan: false,
}

export function loadConfig(): Config {
  const file = homePath("config.json")
  if (!existsSync(file)) return structuredClone(DEFAULTS)
  return { ...structuredClone(DEFAULTS), ...JSON.parse(readFileSync(file, "utf8")) }
}

// Whether the user (or a previous init) chose a language, as opposed to the default.
export function languageChosen(): boolean {
  const file = homePath("config.json")
  return existsSync(file) && "language" in (JSON.parse(readFileSync(file, "utf8")) as object)
}

const SETTINGS: Record<string, (value: string) => Partial<Config> | null> = {
  language: (v) => (v === "en" || v === "es" ? { language: v } : null),
  dailyNewCards: (v) => (/^\d+$/.test(v) && Number(v) <= 100 ? { dailyNewCards: Number(v) } : null),
  port: (v) =>
    /^\d+$/.test(v) && Number(v) >= 1024 && Number(v) <= 65535 ? { port: Number(v) } : null,
}

// Returns null when saved, or the message key that explains why not.
export function setConfigValue(
  key: string,
  value: string,
): "cli.configInvalid" | "cli.configUnknown" | null {
  const parse = SETTINGS[key]
  if (!parse) return "cli.configUnknown"
  const change = parse(value)
  if (!change) return "cli.configInvalid"
  saveConfig({ ...loadConfig(), ...change })
  return null
}

export const SETTING_KEYS = Object.keys(SETTINGS)

export function saveConfig(config: Config): void {
  const file = homePath("config.json")
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}
