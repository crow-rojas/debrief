import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

type Hook = { type: string; command: string; timeout?: number }
type Group = { matcher?: string; hooks: Hook[] }
type Settings = { hooks?: Record<string, Group[]> } & Record<string, unknown>

// Adds a Stop hook to a Claude Code settings.json or a Codex hooks.json (same shape), keeping
// everything else, and backs the file up before its first change.
function installStopHook(file: string, command: string): "added" | "present" {
  const settings: Settings = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Settings)
    : {}
  const stop = settings.hooks?.Stop ?? []
  if (stop.some((group) => group.hooks?.some((hook) => hook.command === command))) return "present"
  const backup = `${file}.ownship-backup`
  if (existsSync(file) && !existsSync(backup)) copyFileSync(file, backup)
  settings.hooks = {
    ...settings.hooks,
    Stop: [...stop, { hooks: [{ type: "command", command, timeout: 10 }] }],
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`)
  return "added"
}

export const installClaudeHook = installStopHook
export const installCodexHook = installStopHook
