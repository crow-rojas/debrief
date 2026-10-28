#!/usr/bin/env node
// node:sqlite prints an ExperimentalWarning on import; drop warnings before loading anything else.
process.removeAllListeners("warning")

const [command] = process.argv.slice(2)

if (command === "daemon") {
  const { startDaemon } = await import("./daemon/main.ts")
  await startDaemon()
} else {
  console.error("usage: ownship daemon")
  process.exit(1)
}
