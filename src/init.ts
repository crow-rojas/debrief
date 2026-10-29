import { fileURLToPath } from "node:url"
import pkg from "../package.json" with { type: "json" }
import type { AgentName } from "./capture/event.ts"
import { languageChosen, loadConfig, saveConfig } from "./config.ts"
import { ensureDaemon } from "./daemon/lifecycle.ts"
import { ensureToken } from "./daemon/token.ts"
import { installedAgents } from "./generate/presets.ts"
import {
  claudeSettingsPath,
  codexHooksPath,
  installClaudeHook,
  installCodexHook,
} from "./hooks/install.ts"
import { t } from "./messages.ts"
import type { PairingProbe } from "./pair.ts"

export function meetsMinimum(version: string, engines: string): boolean {
  const parse = (v: string) => (v.match(/\d+(\.\d+){0,2}/)?.[0] ?? "0").split(".").map(Number)
  const [have, need] = [parse(version), parse(engines)]
  for (let i = 0; i < 3; i++) {
    const diff = (have[i] ?? 0) - (need[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return true
}

// The command an agent's Stop hook runs: this very CLI, by absolute path, so it works after npx.
export function hookCommand(agent: AgentName): string {
  const fromSource = import.meta.url.endsWith(".ts")
  const cli = fileURLToPath(new URL(`./cli.${fromSource ? "ts" : "js"}`, import.meta.url))
  const flags = fromSource ? " --experimental-strip-types --no-warnings" : " --no-warnings"
  return `"${process.execPath}"${flags} "${cli}" hook ${agent}`
}

// The language of the user's locale, for a first install that has not chosen one.
export function detectLanguage(env: NodeJS.ProcessEnv = process.env): "en" | "es" {
  const locale =
    env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale
  return /^es([_-]|$)/i.test(locale) ? "es" : "en"
}

type InitOptions = {
  hooks: boolean
  env?: NodeJS.ProcessEnv
  open?: (url: string) => void
  probe?: PairingProbe
  qr?: (link: string) => void
  nodeVersion?: string
  installed?: AgentName[]
  startDaemon?: () => Promise<{ port: number }>
  claudeSettings?: string
  codexHooks?: string
}

export async function init(opts: InitOptions): Promise<{ ok: boolean; lines: string[] }> {
  const config = loadConfig()
  if (!languageChosen()) config.language = detectLanguage(opts.env)
  const lang = config.language
  const required = pkg.engines.node.replace(/^>=/, "")
  const current = opts.nodeVersion ?? process.versions.node
  if (!meetsMinimum(current, pkg.engines.node)) {
    return { ok: false, lines: [t(lang, "cli.nodeTooOld", { required, current })] }
  }
  const lines: string[] = []
  const installed = opts.installed ?? installedAgents()
  if (installed.length === 0) lines.push(t(lang, "cli.noAgents"))
  else lines.push(t(lang, "cli.agentsFound", { agents: installed.join(", ") }))

  if (opts.hooks) {
    const claudeFile = opts.claudeSettings ?? claudeSettingsPath()
    const codexFile = opts.codexHooks ?? codexHooksPath()
    if (installed.includes("claude-code")) {
      const result = installClaudeHook(claudeFile, hookCommand("claude-code"))
      lines.push(
        t(lang, result === "added" ? "cli.hookAdded" : "cli.hookPresent", { file: claudeFile }),
      )
    }
    if (installed.includes("codex")) {
      const result = installCodexHook(codexFile, hookCommand("codex"))
      lines.push(
        t(lang, result === "added" ? "cli.hookAdded" : "cli.hookPresent", { file: codexFile }),
      )
      if (result === "added") lines.push(t(lang, "cli.codexTrust"))
    }
  }

  saveConfig(config)
  const token = ensureToken()
  const { port } = await (opts.startDaemon ?? ensureDaemon)()
  lines.push(t(lang, "cli.started", { port }))
  const desktop = `http://127.0.0.1:${port}/pair?token=${token}`
  lines.push(t(lang, "cli.openDesktop", { url: desktop }))
  opts.open?.(desktop)

  // The phone comes for free only over Tailscale; a plain-HTTP LAN stays an explicit `ownship pair`.
  const tailscale = await opts.probe?.tailscale()
  let served = false
  if (opts.probe && tailscale) {
    try {
      await opts.probe.serve(port)
      served = true
    } catch (error) {
      lines.push(t(lang, "cli.tailscaleServeFailed", { reason: (error as Error).message.trim() }))
    }
  }
  if (served && tailscale) {
    lines.push(t(lang, "cli.phoneTailscale"))
    opts.qr?.(`https://${tailscale.dnsName.replace(/\.$/, "")}/pair?token=${token}`)
  } else lines.push(t(lang, "cli.phoneHint"))
  return { ok: true, lines }
}
