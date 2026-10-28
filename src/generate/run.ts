import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { GeneratorOutput } from "../cards/types.ts"
import { cardSchema, validateOutput } from "./schema.ts"

// command may hold {schema} (inline JSON), {schemaFile} and {outputFile}; with {outputFile} the
// result is read from that file instead of stdout. "claude" reads structured_output from its JSON.
export type GeneratorConfig = {
  command: string[]
  schema: "claude" | "codex" | "validate"
  timeoutMs: number
  research: { command: string[] }
}

export class GeneratorError extends Error {
  constructor(
    readonly reason: "missing" | "timeout" | "exit" | "invalid",
    message: string,
  ) {
    super(message)
  }
}

function once(g: GeneratorConfig, prompt: string, research: boolean, cwd: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "ownship-gen-"))
  const schemaFile = join(dir, "schema.json")
  const outputFile = join(dir, "output.json")
  writeFileSync(schemaFile, JSON.stringify(cardSchema))
  const template = research ? g.research.command : g.command
  const usesOutputFile = template.some((arg) => arg.includes("{outputFile}"))
  const [command, ...args] = template.map((arg) =>
    arg
      .replace("{schema}", JSON.stringify(cardSchema))
      .replace("{schemaFile}", schemaFile)
      .replace("{outputFile}", outputFile),
  )
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command ?? "", args, {
      cwd,
      env: { ...process.env, OWNSHIP_GENERATING: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new GeneratorError("timeout", `the generator took more than ${g.timeoutMs} ms`))
    }, g.timeoutMs)
    child.stdout.on("data", (d) => (stdout += d))
    child.stderr.on("data", (d) => (stderr += d))
    child.stdin.on("error", () => {})
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(
        error.code === "ENOENT"
          ? new GeneratorError("missing", `${command} is not installed or not on PATH`)
          : new GeneratorError("exit", error.message),
      )
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(
          new GeneratorError(
            "exit",
            `${command} exited with ${code}: ${stderr.trim().slice(-500)}`,
          ),
        )
        return
      }
      try {
        resolve(usesOutputFile ? readFileSync(outputFile, "utf8") : stdout)
      } catch {
        reject(new GeneratorError("invalid", `${command} wrote no output file`))
      }
    })
    child.stdin.end(prompt)
  }).finally(() => rmSync(dir, { recursive: true, force: true }))
}

function parse(g: GeneratorConfig, text: string): GeneratorOutput {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new GeneratorError("invalid", "the output is not JSON")
  }
  if (g.schema === "claude") value = (value as { structured_output?: unknown }).structured_output
  const problem = validateOutput(value)
  if (problem) throw new GeneratorError("invalid", problem)
  return value as GeneratorOutput
}

export async function runGenerator(
  g: GeneratorConfig,
  prompt: string,
  opts: { research: boolean; cwd?: string },
): Promise<GeneratorOutput> {
  const cwd = opts.cwd ?? tmpdir()
  try {
    return parse(g, await once(g, prompt, opts.research, cwd))
  } catch (error) {
    if (!(error instanceof GeneratorError) || error.reason !== "invalid") throw error
    const retry = `${prompt}\n\nYour previous answer was rejected: ${error.message}. Reply with JSON that matches the schema, and nothing else.`
    return parse(g, await once(g, retry, opts.research, cwd))
  }
}
