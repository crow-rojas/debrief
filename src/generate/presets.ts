import type { AgentName } from "../capture/event.ts"
import type { Config } from "../config.ts"
import type { GeneratorConfig } from "./run.ts"

// The anti-recursion flags (no session log, no hooks) are part of the presets, not left to the user.
// Flags checked against claude 2.1.312 and codex 0.159.0 (docs/research/versions.md).
const claude = (tools: string[]) => [
  "claude",
  "-p",
  "--no-session-persistence",
  ...tools,
  "--output-format",
  "json",
  "--json-schema",
  "{schema}",
]
const codex = (sandbox: string) => [
  "codex",
  "exec",
  "--ephemeral",
  "--disable",
  "hooks",
  "-s",
  sandbox,
  "--skip-git-repo-check",
  "--output-schema",
  "{schemaFile}",
  "-o",
  "{outputFile}",
  "-",
]

export const presets: Record<AgentName, GeneratorConfig> = {
  "claude-code": {
    command: claude(["--tools", ""]),
    schema: "claude",
    timeoutMs: 180_000,
    research: { command: claude([]) },
  },
  codex: {
    command: codex("read-only"),
    schema: "codex",
    timeoutMs: 180_000,
    research: { command: codex("read-only") },
  },
}

export function pickGenerator(
  config: Config,
  agent: AgentName,
  installed: AgentName[],
): GeneratorConfig | null {
  if (typeof config.generator === "object" && config.generator !== null)
    return config.generator as GeneratorConfig
  if (installed.includes(agent)) return presets[agent]
  const other = installed[0]
  return other ? presets[other] : null
}
