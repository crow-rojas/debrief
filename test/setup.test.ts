import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadConfig, saveConfig, setConfigValue } from "../src/config.ts"
import { stopDaemon } from "../src/daemon/lifecycle.ts"
import { hasStopHook, installClaudeHook, removeStopHook } from "../src/hooks/install.ts"
import { detectLanguage, init } from "../src/init.ts"
import { homePath } from "../src/paths.ts"
import { uninstall } from "../src/uninstall.ts"
import { tempHome } from "./helpers.ts"

const OURS = '"/usr/bin/node" --no-warnings "/opt/ownship/dist/src/cli.js" hook claude-code'
const dir = () => mkdtempSync(join(tmpdir(), "setup-"))
const start = async () => ({ port: 4321 })

describe("plug-and-play setup", () => {
  beforeEach(() => {
    tempHome()
  })

  it("detects the language from the locale", () => {
    expect(detectLanguage({ LANG: "es_CL.UTF-8" })).toBe("es")
    expect(detectLanguage({ LC_ALL: "es-AR" })).toBe("es")
    expect(detectLanguage({ LANG: "en_US.UTF-8" })).toBe("en")
    expect(detectLanguage({})).toMatch(/^(en|es)$/)
  })

  it("init saves the detected language on a fresh install and keeps a chosen one", async () => {
    await init({ hooks: false, installed: [], startDaemon: start, env: { LANG: "es_CL.UTF-8" } })
    expect(loadConfig().language).toBe("es")
    saveConfig({ ...loadConfig(), language: "en" })
    await init({ hooks: false, installed: [], startDaemon: start, env: { LANG: "es_CL.UTF-8" } })
    expect(loadConfig().language).toBe("en")
  })

  it("init opens the paired app in the browser", async () => {
    const open = vi.fn()
    await init({ hooks: false, installed: [], startDaemon: start, open })
    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:4321\/pair\?token=/),
    )
  })

  it("init shows the phone QR when Tailscale is running, and only hints at pairing otherwise", async () => {
    const qr = vi.fn()
    const serve = vi.fn(async () => {})
    const tailscale = {
      tailscale: async () => ({ dnsName: "mac.ts.net." }),
      lanIp: () => "192.168.1.2",
      serve,
    }
    const withTailscale = await init({
      hooks: false,
      installed: [],
      startDaemon: start,
      probe: tailscale,
      qr,
    })
    expect(qr).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/mac\.ts\.net\/pair\?token=/))
    expect(withTailscale.lines.join("\n")).toContain("Tailscale")

    qr.mockClear()
    const lanOnly = { ...tailscale, tailscale: async () => null }
    const without = await init({
      hooks: false,
      installed: [],
      startDaemon: start,
      probe: lanOnly,
      qr,
    })
    expect(qr).not.toHaveBeenCalled()
    expect(without.lines.join("\n")).toContain("ownship pair")
  })

  it("init falls back to the pairing hint when tailscale serve fails or hangs", async () => {
    const qr = vi.fn()
    const probe = {
      tailscale: async () => ({ dnsName: "mac.ts.net." }),
      lanIp: () => null,
      serve: async () => {
        throw new Error(
          "Serve is not enabled on your tailnet. To enable, visit https://login.tailscale.com/x",
        )
      },
    }
    const result = await init({ hooks: false, installed: [], startDaemon: start, probe, qr })
    expect(result.ok).toBe(true)
    expect(qr).not.toHaveBeenCalled()
    const text = result.lines.join("\n")
    expect(text).toContain("https://login.tailscale.com/x")
    expect(text).toContain("ownship pair")
  })

  it("removes only ownship's Stop hook", () => {
    const file = join(dir(), "settings.json")
    writeFileSync(
      file,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: "command", command: "afplay done.wav" }] }] },
      }),
    )
    installClaudeHook(file, OURS)
    expect(hasStopHook(file)).toBe(true)
    expect(removeStopHook(file)).toBe("removed")
    expect(hasStopHook(file)).toBe(false)
    expect(JSON.parse(readFileSync(file, "utf8")).hooks.Stop).toEqual([
      { hooks: [{ type: "command", command: "afplay done.wav" }] },
    ])
    expect(removeStopHook(file)).toBe("absent")
    expect(removeStopHook(join(dir(), "missing.json"))).toBe("absent")
  })

  it("uninstall removes the hooks and stops the daemon, and purge deletes ownship's data", async () => {
    const d = dir()
    const claudeSettings = join(d, "settings.json")
    const codexHooks = join(d, "hooks.json")
    installClaudeHook(claudeSettings, OURS)
    installClaudeHook(codexHooks, OURS.replace("claude-code", "codex"))
    saveConfig(loadConfig())
    const stop = vi.fn(async () => true)
    const kept = await uninstall({ purge: false, claudeSettings, codexHooks, stop })
    expect(hasStopHook(claudeSettings) || hasStopHook(codexHooks)).toBe(false)
    expect(stop).toHaveBeenCalled()
    expect(existsSync(homePath("config.json"))).toBe(true)
    expect(kept.lines.length).toBeGreaterThan(0)
    await uninstall({ purge: true, claudeSettings, codexHooks, stop })
    expect(existsSync(homePath())).toBe(false)
  })

  it("stopDaemon never kills a process that is not a healthy ownship daemon", async () => {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], {
      stdio: "ignore",
    })
    try {
      saveConfig(loadConfig())
      writeFileSync(homePath("daemon.json"), JSON.stringify({ pid: child.pid, port: 1 }))
      expect(await stopDaemon()).toBe(false)
      expect(() => process.kill(child.pid!, 0)).not.toThrow()
    } finally {
      child.kill()
    }
  })

  it("sets config values with validation", () => {
    expect(setConfigValue("language", "es")).toBeNull()
    expect(loadConfig().language).toBe("es")
    expect(setConfigValue("dailyNewCards", "5")).toBeNull()
    expect(loadConfig().dailyNewCards).toBe(5)
    expect(setConfigValue("language", "fr")).toBe("cli.configInvalid")
    expect(setConfigValue("dailyNewCards", "lots")).toBe("cli.configInvalid")
    expect(setConfigValue("token", "x")).toBe("cli.configUnknown")
  })
})
