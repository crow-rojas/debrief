import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { init, meetsMinimum } from "../src/init.ts"
import { t } from "../src/messages.ts"
import { tempHome } from "./helpers.ts"

describe("ownship init", () => {
  beforeEach(() => {
    tempHome()
  })

  it("compares Node versions against the engines floor", () => {
    expect(meetsMinimum("22.15.0", ">=22.15.0")).toBe(true)
    expect(meetsMinimum("23.1.0", ">=22.15.0")).toBe(true)
    expect(meetsMinimum("22.14.9", ">=22.15.0")).toBe(false)
  })

  it("init refuses a Node older than engines", async () => {
    const start = vi.fn(async () => ({ port: 1 }))
    const result = await init({
      nodeVersion: "20.11.0",
      hooks: true,
      installed: ["codex"],
      startDaemon: start,
    })
    expect(result.ok).toBe(false)
    expect(result.lines.join("\n")).toContain("ownship needs Node 22.15.0 or newer")
    expect(start).not.toHaveBeenCalled()
  })

  it("init with no hooks installs nothing and starts the daemon", async () => {
    const dir = mkdtempSync(join(tmpdir(), "init-"))
    const claudeSettings = join(dir, "claude", "settings.json")
    const codexHooks = join(dir, "codex", "hooks.json")
    const start = vi.fn(async () => ({ port: 4321 }))
    const result = await init({
      hooks: false,
      installed: ["claude-code", "codex"],
      startDaemon: start,
      claudeSettings,
      codexHooks,
    })
    expect(result.ok).toBe(true)
    expect(existsSync(claudeSettings)).toBe(false)
    expect(existsSync(codexHooks)).toBe(false)
    expect(result.lines.join("\n")).toContain("http://127.0.0.1:4321/pair?token=")
  })

  it("init with hooks installs them and explains the Codex trust step", async () => {
    const dir = mkdtempSync(join(tmpdir(), "init-"))
    const claudeSettings = join(dir, "claude", "settings.json")
    const codexHooks = join(dir, "codex", "hooks.json")
    const result = await init({
      hooks: true,
      installed: ["claude-code", "codex"],
      startDaemon: async () => ({ port: 1 }),
      claudeSettings,
      codexHooks,
    })
    expect(existsSync(claudeSettings)).toBe(true)
    expect(existsSync(codexHooks)).toBe(true)
    expect(result.lines.join("\n")).toContain("/hooks")
  })

  it("speaks the configured language", () => {
    expect(t("es", "cli.statusStopped")).toBe("detenido")
    expect(t("en", "cli.started", { port: 7 })).toBe("The ownship daemon is running on port 7.")
  })
})
