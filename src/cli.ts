#!/usr/bin/env node
// node:sqlite prints an ExperimentalWarning on import; drop warnings before loading anything else.
process.removeAllListeners("warning")

import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { createInterface } from "node:readline/promises"
import { parseArgs } from "node:util"

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { yes: { type: "boolean" }, "no-hooks": { type: "boolean" } },
})
const [command, arg] = positionals

const { loadConfig, saveConfig } = await import("./config.ts")
const { t } = await import("./messages.ts")
const lang = loadConfig().language
const say = (key: string, vars?: Record<string, string | number>) => console.log(t(lang, key, vars))

async function askHooks(): Promise<boolean> {
  if (values["no-hooks"]) return false
  if (values.yes || !process.stdin.isTTY) return true
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question(t(lang, "cli.hooksQuestion"))).trim().toLowerCase()
  rl.close()
  return answer === "" || answer.startsWith("y") || answer.startsWith("s")
}

async function status(): Promise<void> {
  const { daemonInfo, healthy } = await import("./daemon/lifecycle.ts")
  const { openDb } = await import("./db.ts")
  const { flaggedShare } = await import("./knowledge/notes.ts")
  const info = daemonInfo()
  const running = info && (await healthy(info.port))
  say("cli.statusDaemon", {
    state: running
      ? t(lang, "cli.statusRunning", { port: info.port })
      : t(lang, "cli.statusStopped"),
  })
  const db = openDb()
  const count = (sql: string, ...args: string[]) =>
    (db.prepare(sql).get(...args) as { n: number }).n
  const byState = (state: string) => count("SELECT count(*) AS n FROM turns WHERE state = ?", state)
  say("cli.statusTurns", {
    queued: byState("queued"),
    generated: byState("generated"),
    failed: byState("failed"),
  })
  say("cli.statusCards", {
    due: count(
      "SELECT count(*) AS n FROM cards WHERE state = 'active' AND due <= ?",
      new Date().toISOString(),
    ),
    total: count("SELECT count(*) AS n FROM cards"),
    flagged: Math.round(flaggedShare(db) * 100),
  })
  const last = db
    .prepare("SELECT last_error FROM turns WHERE last_error IS NOT NULL ORDER BY id DESC LIMIT 1")
    .get() as { last_error: string } | undefined
  if (last) say("cli.statusLastError", { error: last.last_error })
}

async function pair(): Promise<void> {
  const { choosePairing, systemProbe } = await import("./pair.ts")
  const { daemonInfo, ensureDaemon } = await import("./daemon/lifecycle.ts")
  const { ensureToken } = await import("./daemon/token.ts")
  const { port } = await ensureDaemon()
  const choice = await choosePairing(systemProbe, port)
  if (!choice) {
    say("cli.noNetwork")
    process.exitCode = 1
    return
  }
  if (choice.via === "lan" && !loadConfig().lan) {
    // Restart the daemon so it listens beyond localhost.
    saveConfig({ ...loadConfig(), lan: true })
    const info = daemonInfo()
    if (info) process.kill(info.pid)
    await new Promise((r) => setTimeout(r, 500))
    await ensureDaemon()
  }
  say(choice.via === "tailscale" ? "cli.pairTailscale" : "cli.pairLan")
  if (choice.warning) say(choice.warning)
  const link = `${choice.url}/pair?token=${ensureToken()}`
  say("cli.scan")
  const qrcode = createRequire(import.meta.url)("qrcode-terminal") as {
    generate(text: string, opts: { small: boolean }, done: (qr: string) => void): void
  }
  qrcode.generate(link, { small: true }, (qr) => console.log(qr))
  console.log(link)
}

if (command === "daemon") {
  const { startDaemon } = await import("./daemon/main.ts")
  await startDaemon()
} else if (command === "hook") {
  const { doorbell } = await import("./hooks/doorbell.ts")
  await doorbell(readFileSync(0, "utf8"), process.env, arg === "codex" ? "codex" : "claude-code")
  process.exit(0)
} else if (command === "init") {
  const { init } = await import("./init.ts")
  const result = await init({ hooks: await askHooks() })
  for (const line of result.lines) console.log(line)
  if (!result.ok) process.exitCode = 1
} else if (command === "start") {
  const { ensureDaemon } = await import("./daemon/lifecycle.ts")
  say("cli.started", { port: (await ensureDaemon()).port })
} else if (command === "status") {
  await status()
} else if (command === "pair") {
  await pair()
} else {
  say("cli.usage")
  process.exitCode = command ? 1 : 0
}
