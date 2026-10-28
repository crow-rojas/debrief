#!/usr/bin/env node
// Stands in for claude/codex in tests. FAKE_MODE picks the behavior; FAKE_ENV_OUT records the env.
import { existsSync, readFileSync, writeFileSync } from "node:fs"

const input = readFileSync(0, "utf8")
if (process.env.FAKE_ENV_OUT) {
  writeFileSync(process.env.FAKE_ENV_OUT, JSON.stringify({ generating: process.env.OWNSHIP_GENERATING, input }))
}
const valid = process.env.FAKE_OUTPUT ?? JSON.stringify({
  cards: [
    {
      kind: "choice",
      question: "What does the import do with valid rows when one row fails?",
      explanation: "The loop runs inside one transaction.",
      evidence: [{ source: "message", quote: "inside one transaction", path: null, line: null }],
      options: ["Saves them", "Saves none", "Saves up to the failure"],
      correct: 1,
    },
  ],
})
const mode = process.env.FAKE_MODE ?? "valid"
if (mode === "exit1") process.exit(1)
if (mode === "sleep") await new Promise((r) => setTimeout(r, 10_000))
if (mode === "garbage") process.stdout.write("not json")
else if (mode === "garbage-once") {
  const state = process.env.FAKE_STATE
  if (state && !existsSync(state)) {
    writeFileSync(state, "1")
    process.stdout.write("not json")
  } else process.stdout.write(valid)
} else process.stdout.write(valid)
