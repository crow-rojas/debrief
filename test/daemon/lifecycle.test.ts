import { readFileSync, writeFileSync } from "node:fs"
import pkg from "../../package.json" with { type: "json" }
import { afterEach, describe, expect, it } from "vitest"
import { ensureDaemon } from "../../src/daemon/lifecycle.ts"
import { saveConfig, loadConfig } from "../../src/config.ts"
import { homePath } from "../../src/paths.ts"
import { tempHome } from "../helpers.ts"

let pid = 0
const info = () => JSON.parse(readFileSync(homePath("daemon.json"), "utf8"))

function freshHome() {
  const home = tempHome()
  // Keep the spawned daemon away from the real agent logs.
  process.env.CLAUDE_CONFIG_DIR = home
  process.env.CODEX_HOME = home
  saveConfig({ ...loadConfig(), port: 47000 + Math.floor(Math.random() * 900) })
}

describe("ensureDaemon", () => {
  afterEach(() => {
    if (pid) process.kill(pid)
  })

  it("starts one daemon and reuses it", async () => {
    freshHome()
    const first = await ensureDaemon()
    pid = JSON.parse(readFileSync(homePath("daemon.json"), "utf8")).pid
    const second = await ensureDaemon()
    expect(second.port).toBe(first.port)
    expect(JSON.parse(readFileSync(homePath("daemon.json"), "utf8")).pid).toBe(pid)
    expect((await fetch(`http://127.0.0.1:${first.port}/api/health`)).status).toBe(200)
  })

  it("replaces a daemon older than this CLI, as after an update", async () => {
    freshHome()
    await ensureDaemon()
    const old = info()
    expect(old.version).toBe(pkg.version)
    writeFileSync(homePath("daemon.json"), JSON.stringify({ pid: old.pid, port: old.port }))
    pid = old.pid
    await ensureDaemon()
    pid = info().pid
    expect(pid).not.toBe(old.pid)
    expect(info().version).toBe(pkg.version)
  })

  it("keeps a daemon newer than this CLI", async () => {
    freshHome()
    await ensureDaemon()
    pid = info().pid
    writeFileSync(homePath("daemon.json"), JSON.stringify({ ...info(), version: "999.0.0" }))
    await ensureDaemon()
    expect(info().pid).toBe(pid)
  })
})
