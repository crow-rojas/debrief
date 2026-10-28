import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"
import { ensureDaemon } from "../../src/daemon/lifecycle.ts"
import { saveConfig, loadConfig } from "../../src/config.ts"
import { homePath } from "../../src/paths.ts"
import { tempHome } from "../helpers.ts"

let pid = 0

describe("ensureDaemon", () => {
  afterEach(() => {
    if (pid) process.kill(pid)
  })

  it("starts one daemon and reuses it", async () => {
    const home = tempHome()
    // Keep the spawned daemon away from the real agent logs.
    process.env.CLAUDE_CONFIG_DIR = home
    process.env.CODEX_HOME = home
    saveConfig({ ...loadConfig(), port: 47000 + Math.floor(Math.random() * 900) })
    const first = await ensureDaemon()
    pid = JSON.parse(readFileSync(homePath("daemon.json"), "utf8")).pid
    const second = await ensureDaemon()
    expect(second.port).toBe(first.port)
    expect(JSON.parse(readFileSync(homePath("daemon.json"), "utf8")).pid).toBe(pid)
    expect((await fetch(`http://127.0.0.1:${first.port}/api/health`)).status).toBe(200)
  })
})
