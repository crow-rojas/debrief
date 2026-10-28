import { existsSync, statSync } from "node:fs"
import { beforeEach, describe, expect, it } from "vitest"
import { loadConfig, saveConfig } from "../src/config.ts"
import { homePath } from "../src/paths.ts"
import { tempHome } from "./helpers.ts"

describe("config", () => {
  beforeEach(() => {
    tempHome()
  })

  it("loadConfig returns defaults when no file exists", () => {
    const config = loadConfig()
    expect(config.dailyNewCards).toBe(10)
    expect(config.language).toBe("en")
    expect(config.generator).toBe("auto")
    expect(config.lan).toBe(false)
    expect(config.exclude).toEqual([])
    expect(config.port).toBe(47821)
    expect(config.repos).toEqual({})
  })

  it("fills missing keys from defaults and keeps the file private", () => {
    saveConfig({ ...loadConfig(), language: "es" })
    expect(loadConfig().language).toBe("es")
    expect(loadConfig().dailyNewCards).toBe(10)
    const file = homePath("config.json")
    expect(existsSync(file)).toBe(true)
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })
})
