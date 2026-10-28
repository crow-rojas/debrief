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

export function saveConfig(config: Config): void {
  const file = homePath("config.json")
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}
