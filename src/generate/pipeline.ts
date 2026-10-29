import type { DatabaseSync } from "node:sqlite"
import { storeCards } from "../cards/store.ts"
import type { Config } from "../config.ts"
import { readNotes } from "../knowledge/notes.ts"
import { filterTurn } from "./filter.ts"
import { installedAgents, pickGenerator } from "./presets.ts"
import { buildPrompt } from "./prompt.ts"
import { newCardsToday, nextTurn } from "./queue.ts"
import { GeneratorError, runGenerator } from "./run.ts"

const MAX_ATTEMPTS = 3

type Deps = { run?: typeof runGenerator; notes?: (slug: string) => string[] }

export async function runPipelineOnce(
  db: DatabaseSync,
  config: Config,
  now: Date,
  deps: Deps = {},
): Promise<"idle" | "capped" | "generated" | "failed"> {
  const turn = nextTurn(db, now, config.dailyNewCards)
  if (!turn) return newCardsToday(db, now) >= config.dailyNewCards ? "capped" : "idle"
  try {
    const generator = pickGenerator(config, turn.agent, installedAgents())
    if (!generator) throw new GeneratorError("missing", "neither claude nor codex is on PATH")
    const filtered = await filterTurn(turn.event)
    const prompt = buildPrompt(filtered, (deps.notes ?? readNotes)(turn.slug), config.language)
    const research = config.repos[turn.slug]?.research === true
    const output = await (deps.run ?? runGenerator)(generator, prompt, {
      research,
      cwd: research ? turn.worktree : undefined,
    })
    storeCards(db, turn.id, output.cards, filtered, now)
    db.prepare("UPDATE turns SET state = 'generated', last_error = NULL WHERE id = ?").run(turn.id)
    return "generated"
  } catch (error) {
    const reason = (error as { reason?: string }).reason
    const message = reason ? `${reason}: ${(error as Error).message}` : (error as Error).message
    // A missing, logged-out, failing or slow generator is an outage, not this turn's fault: it stays
    // queued (and still expires after a week). Only output the generator got wrong spends attempts.
    const outage = reason === "missing" || reason === "timeout" || reason === "exit"
    const attempts = outage ? turn.attempts : turn.attempts + 1
    db.prepare("UPDATE turns SET attempts = ?, last_error = ?, state = ? WHERE id = ?").run(
      attempts,
      message,
      attempts >= MAX_ATTEMPTS ? "failed" : "queued",
      turn.id,
    )
    return "failed"
  }
}
