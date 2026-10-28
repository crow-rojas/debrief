import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { loadConfig } from "../config.ts"
import { homePath } from "../paths.ts"

type DaemonInfo = { pid: number; port: number }

export function daemonInfo(): DaemonInfo | null {
  const file = homePath("daemon.json")
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, "utf8")) as DaemonInfo
  } catch {
    return null
  }
}

export async function healthy(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(500),
    })
    return res.ok
  } catch {
    return false
  }
}

// The CLI next to this module: src/cli.ts when running from source, dist/cli.js once built.
function cliEntry(): { path: string; execArgv: string[] } {
  const fromSource = import.meta.url.endsWith(".ts")
  const path = fileURLToPath(new URL(`../cli.${fromSource ? "ts" : "js"}`, import.meta.url))
  return {
    path,
    execArgv: fromSource ? ["--experimental-strip-types", "--no-warnings"] : ["--no-warnings"],
  }
}

export async function ensureDaemon(): Promise<{ port: number }> {
  const info = daemonInfo()
  if (info && (await healthy(info.port))) return { port: info.port }
  const { path, execArgv } = cliEntry()
  const env = { ...process.env }
  delete env.OWNSHIP_GENERATING
  spawn(process.execPath, [...execArgv, path, "daemon"], {
    detached: true,
    stdio: "ignore",
    env,
  }).unref()
  const port = loadConfig().port
  for (let waited = 0; waited < 5000; waited += 100) {
    const started = daemonInfo()
    if (started && (await healthy(started.port))) return { port: started.port }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`the ownship daemon did not start on port ${port}; see ${homePath("daemon.log")}`)
}
