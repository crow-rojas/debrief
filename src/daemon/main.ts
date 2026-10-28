import { appendFileSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { catchUp, processFile, watch } from "../capture/capture.ts"
import { claudeCodeReader } from "../capture/readers/claude-code.ts"
import { codexReader } from "../capture/readers/codex.ts"
import { loadConfig } from "../config.ts"
import { openDb } from "../db.ts"
import { runPipelineOnce } from "../generate/pipeline.ts"
import { homePath } from "../paths.ts"
import { createServer } from "./server.ts"
import { ensureToken } from "./token.ts"

const READERS = [claudeCodeReader, codexReader]

function log(message: string): void {
  appendFileSync(homePath("daemon.log"), `${new Date().toISOString()} ${message}\n`)
}

// The built review app lives in dist/app: next to dist/src once compiled, under the repo from source.
function staticDir(): string {
  const fromSource = import.meta.url.endsWith(".ts")
  return fileURLToPath(new URL(fromSource ? "../../dist/app/" : "../../app/", import.meta.url))
}

export async function startDaemon(): Promise<void> {
  const db = openDb()
  const config = loadConfig()
  const token = ensureToken()

  let running = false
  let again = false
  // One pipeline run at a time; a turn that arrives mid-run triggers another pass.
  const pump = async () => {
    if (running) {
      again = true
      return
    }
    running = true
    try {
      let result
      do {
        again = false
        result = await runPipelineOnce(db, loadConfig(), new Date())
        if (result === "failed") log("generation failed; see ownship status")
      } while (result === "generated" || again)
    } catch (error) {
      log(`pipeline: ${(error as Error).message}`)
    } finally {
      running = false
    }
  }

  await catchUp(db, READERS, new Date())
  const stopWatching = watch(db, READERS, { onStored: () => void pump() })
  const server = createServer(db, config, {
    token,
    staticDir: staticDir(),
    onDoorbell: ({ agent, transcriptPath }) => {
      const reader = READERS.find((r) => r.id === agent)
      if (!reader || !transcriptPath) return void pump()
      // Claude Code may write the last line just after Stop fires, so read again shortly after.
      const read = () =>
        processFile(db, reader, transcriptPath, new Date())
          .then(() => pump())
          .catch((error: Error) => log(`doorbell: ${error.message}`))
      void read()
      setTimeout(read, 1500)
    },
  })
  const timer = setInterval(() => void pump(), 60_000)

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(config.port, config.lan ? "0.0.0.0" : "127.0.0.1", resolve)
  })
  writeFileSync(homePath("daemon.json"), JSON.stringify({ pid: process.pid, port: config.port }))
  log(`listening on ${config.lan ? "0.0.0.0" : "127.0.0.1"}:${config.port}`)
  void pump()

  const stop = () => {
    clearInterval(timer)
    stopWatching()
    server.close()
    rmSync(homePath("daemon.json"), { force: true })
    process.exit(0)
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
}
