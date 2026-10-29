import { rmSync } from "node:fs"
import { loadConfig } from "./config.ts"
import { stopDaemon } from "./daemon/lifecycle.ts"
import { claudeSettingsPath, codexHooksPath, removeStopHook } from "./hooks/install.ts"
import { t } from "./messages.ts"
import { home } from "./paths.ts"

type Options = {
  purge: boolean
  claudeSettings?: string
  codexHooks?: string
  stop?: () => Promise<boolean>
}

export async function uninstall(opts: Options): Promise<{ lines: string[] }> {
  const lang = loadConfig().language
  const lines: string[] = []
  for (const file of [
    opts.claudeSettings ?? claudeSettingsPath(),
    opts.codexHooks ?? codexHooksPath(),
  ]) {
    if (removeStopHook(file) === "removed") lines.push(t(lang, "cli.hookRemoved", { file }))
  }
  lines.push(t(lang, (await (opts.stop ?? stopDaemon)()) ? "cli.stopped" : "cli.notRunning"))
  if (opts.purge) {
    rmSync(home(), { recursive: true, force: true })
    lines.push(t(lang, "cli.purged", { dir: home() }))
  } else lines.push(t(lang, "cli.dataKept", { dir: home() }))
  return { lines }
}
