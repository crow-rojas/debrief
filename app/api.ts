import type { Answer } from "../src/cards/grade.ts"
import type { CardDraft } from "../src/cards/types.ts"

export type SessionCard = CardDraft & { id: number; repo: string; endedAt: string }
// Mirrors of src/daemon/server.ts and src/knowledge/notes.ts, which import node: modules.
export type HomeSummary = {
  due: number
  nextDueAt: string | null
  repos: { slug: string; due: number; lastTurnAt: string }[]
  notes: number
}
export type Note = { slug: string; file: string; text: string }
export type FlagInput = { note?: string; action: "discard" | "regenerate" }

export class NotPairedError extends Error {}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-ownship": "1", ...init?.headers },
  })
  if (res.status === 401) throw new NotPairedError()
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res
}

export async function getLanguage(): Promise<"en" | "es" | null> {
  try {
    const res = await call("/api/settings")
    return ((await res.json()) as { language: "en" | "es" }).language
  } catch {
    return null
  }
}

export async function getSession(limit = 5, repo?: string): Promise<SessionCard[]> {
  const scope = repo === undefined ? "" : `&repo=${encodeURIComponent(repo)}`
  const res = await call(`/api/session?limit=${limit}${scope}`)
  return ((await res.json()) as { cards: SessionCard[] }).cards
}

export async function getHome(): Promise<HomeSummary> {
  return (await (await call("/api/home")).json()) as HomeSummary
}

export async function getNotes(): Promise<Note[]> {
  return ((await (await call("/api/notes")).json()) as { notes: Note[] }).notes
}

// crypto.randomUUID exists only in secure contexts, and LAN pairing is plain HTTP.
function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("")
}

// The same reviewId on every retry, so a flaky network never applies FSRS twice.
export async function answer(cardId: number, answerGiven: Answer, reviewId = newId()) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await call(`/api/cards/${cardId}/answer`, {
        method: "POST",
        body: JSON.stringify({ reviewId, answer: answerGiven }),
      })
      return (await res.json()) as { rating: "again" | "good" }
    } catch (error) {
      if (error instanceof NotPairedError || attempt >= 2) throw error
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
}

export async function flag(cardId: number, input: FlagInput): Promise<void> {
  await call(`/api/cards/${cardId}/flag`, { method: "POST", body: JSON.stringify(input) })
}
