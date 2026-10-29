import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

type Hook = { type: string; command: string; timeout?: number }
type Group = { matcher?: string; hooks: Hook[] }
type Settings = { hooks?: Record<string, Group[]> } & Record<string, unknown>

// ownship's own hook commands: this CLI, by absolute path, with the hook subcommand.
const OURS = /cli\.(js|ts)" hook (claude-code|codex)$/
const isOurs = (hook: Hook) => OURS.test(hook.command)

// Stop hook groups without ownship's own hooks; a group they leave empty goes too, others stay as is.
const withoutOurs = (stop: Group[]) =>
  stop.flatMap((group) => {
    if (!group.hooks?.some(isOurs)) return [group]
    const hooks = group.hooks.filter((hook) => !isOurs(hook))
    return hooks.length > 0 ? [{ ...group, hooks }] : []
  })

// Adds a Stop hook to a Claude Code settings.json or a Codex hooks.json (same shape), keeping
// everything else, and backs the file up before its first change. An ownship hook with another
// command, left by an earlier install or version, gives way to the new one.
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
    Stop: [...withoutOurs(stop), { hooks: [{ type: "command", command, timeout: 10 }] }],
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`)
  return "added"
}

function read(file: string): Settings | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Settings) : null
}

export function hasStopHook(file: string): boolean {
  return Boolean(read(file)?.hooks?.Stop?.some((group) => group.hooks?.some(isOurs)))
}

// Removes ownship's Stop hook and nothing else.
export function removeStopHook(file: string): "removed" | "absent" {
  const settings = read(file)
  if (!settings || !hasStopHook(file)) return "absent"
  settings.hooks = { ...settings.hooks, Stop: withoutOurs(settings.hooks?.Stop ?? []) }
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`)
  return "removed"
}

export const claudeSettingsPath = () =>
  join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "settings.json")
export const codexHooksPath = () =>
  join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "hooks.json")

export const installClaudeHook = installStopHook
export const installCodexHook = installStopHook
