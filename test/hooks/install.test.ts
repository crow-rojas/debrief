import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { installClaudeHook, installCodexHook } from "../../src/hooks/install.ts"

const COMMAND = '"/usr/bin/node" "/opt/ownship/dist/cli.js" hook claude-code'
const dir = () => mkdtempSync(join(tmpdir(), "hooks-"))
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"))

describe("hook install", () => {
  it("installing twice adds one entry", () => {
    const file = join(dir(), "settings.json")
    expect(installClaudeHook(file, COMMAND)).toBe("added")
    expect(installClaudeHook(file, COMMAND)).toBe("present")
    const stop = read(file).hooks.Stop
    expect(
      stop
        .flatMap((g: { hooks: { command: string }[] }) => g.hooks)
        .filter((h: { command: string }) => h.command === COMMAND),
    ).toHaveLength(1)
  })

  it("existing hooks and settings survive the install", () => {
    const file = join(dir(), "settings.json")
    const existing = {
      model: "opus",
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "afplay done.wav" }] }],
        PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "lint" }] }],
      },
    }
    writeFileSync(file, JSON.stringify(existing))
    installClaudeHook(file, COMMAND)
    const after = read(file)
    expect(after.model).toBe("opus")
    expect(after.hooks.PostToolUse).toEqual(existing.hooks.PostToolUse)
    expect(after.hooks.Stop).toHaveLength(2)
    expect(after.hooks.Stop[0]).toEqual(existing.hooks.Stop[0])
  })

  it("a backup is written before the first change", () => {
    const file = join(dir(), "settings.json")
    writeFileSync(file, '{"model":"opus"}')
    installClaudeHook(file, COMMAND)
    expect(readFileSync(`${file}.ownship-backup`, "utf8")).toBe('{"model":"opus"}')
    installClaudeHook(file, `${COMMAND} again`)
    expect(readFileSync(`${file}.ownship-backup`, "utf8")).toBe('{"model":"opus"}')
  })

  it("creates a missing file without a backup, and does the same for Codex", () => {
    const d = dir()
    expect(installCodexHook(join(d, "hooks.json"), COMMAND)).toBe("added")
    expect(existsSync(join(d, "hooks.json.ownship-backup"))).toBe(false)
    expect(read(join(d, "hooks.json")).hooks.Stop[0].hooks[0]).toMatchObject({
      type: "command",
      command: COMMAND,
    })
  })
})
