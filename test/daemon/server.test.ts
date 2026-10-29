import { mkdtempSync, writeFileSync } from "node:fs"
import { connect, type AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { CardDraft } from "../../src/cards/types.ts"
import { loadConfig } from "../../src/config.ts"
import { createServer } from "../../src/daemon/server.ts"
import { openDb } from "../../src/db.ts"
import { writeNote } from "../../src/knowledge/notes.ts"
import { insertTurn, tempHome } from "../helpers.ts"

const TOKEN = "test-token"
const card: CardDraft = {
  kind: "choice",
  question: "Where does the check run?",
  explanation: "clean()",
  evidence: [{ source: "message", quote: "x", path: null, line: null }],
  options: ["a", "b", "c"],
  correct: 1,
}

let close: () => void = () => {}
let base = ""
let db: ReturnType<typeof openDb>

async function start() {
  db = openDb()
  const turnId = insertTurn(db, new Date().toISOString())
  db.prepare(
    "INSERT INTO cards (turn_id, kind, payload_json, created_at, state, due) VALUES (?, 'choice', ?, ?, 'active', ?)",
  ).run(
    turnId,
    JSON.stringify(card),
    new Date().toISOString(),
    new Date(Date.now() - 1000).toISOString(),
  )
  const staticDir = mkdtempSync(join(tmpdir(), "static-"))
  writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>ownship</title>")
  const server = createServer(db, loadConfig(), { token: TOKEN, staticDir })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => server.close()
}

// Adds an active card on a turn of its own, under slug, due at due; returns the card id.
function addCard(slug: string, due: Date, endedAt = new Date()): number {
  const turnId = insertTurn(db, endedAt.toISOString(), "/w", `t-${slug}-${due.toISOString()}`)
  db.prepare("UPDATE turns SET slug = ? WHERE id = ?").run(slug, turnId)
  return Number(
    db
      .prepare(
        "INSERT INTO cards (turn_id, kind, payload_json, created_at, state, due) VALUES (?, 'choice', ?, ?, 'active', ?)",
      )
      .run(turnId, JSON.stringify(card), new Date().toISOString(), due.toISOString())
      .lastInsertRowid,
  )
}

const get = async (path: string) => (await fetch(base + path, { headers: auth })).json()

const auth = { authorization: `Bearer ${TOKEN}` }
const post = (
  path: string,
  body: unknown,
  headers: Record<string, string> = { ...auth, "x-ownship": "1" },
) =>
  fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

describe("daemon server", () => {
  beforeEach(async () => {
    tempHome()
    await start()
  })
  afterEach(() => close())

  it("rejects /api/session without a token, including from localhost", async () => {
    expect((await fetch(`${base}/api/session`)).status).toBe(401)
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
    const ok = await fetch(`${base}/api/session`, { headers: auth })
    const body = (await ok.json()) as { cards: { id: number; repo: string; question: string }[] }
    expect(body.cards).toHaveLength(1)
    expect(body.cards[0]).toMatchObject({
      id: 1,
      repo: "w-00000000",
      question: "Where does the check run?",
    })
  })

  it("reports the configured language", async () => {
    expect(await (await fetch(`${base}/api/settings`, { headers: auth })).json()).toEqual({
      language: "en",
    })
  })

  it("rejects a POST without X-Ownship", async () => {
    const res = await post(
      "/api/cards/1/answer",
      { reviewId: "r1", answer: { kind: "choice", picked: 1 } },
      auth,
    )
    expect(res.status).toBe(403)
  })

  it("answering applies FSRS once even when the same reviewId is sent twice", async () => {
    const first = await post("/api/cards/1/answer", {
      reviewId: "r1",
      answer: { kind: "choice", picked: 1 },
    })
    expect(await first.json()).toEqual({ rating: "good" })
    const due = db.prepare("SELECT due FROM cards WHERE id = 1").get()
    const again = await post("/api/cards/1/answer", {
      reviewId: "r1",
      answer: { kind: "choice", picked: 0 },
    })
    expect(await again.json()).toEqual({ rating: "good" })
    expect(db.prepare("SELECT due FROM cards WHERE id = 1").get()).toEqual(due)
    expect(db.prepare("SELECT count(*) AS n FROM reviews").get()).toEqual({ n: 1 })
    const session = (await (await fetch(`${base}/api/session`, { headers: auth })).json()) as {
      cards: unknown[]
    }
    expect(session.cards).toEqual([])
  })

  it("flags a card", async () => {
    expect((await post("/api/cards/1/flag", { action: "discard" })).status).toBe(204)
    expect(db.prepare("SELECT state FROM cards WHERE id = 1").get()).toEqual({ state: "discarded" })
  })

  it("never serves a file outside the static dir", async () => {
    expect((await fetch(`${base}/../package.json`)).status).toBe(404)
    expect((await fetch(`${base}/%2e%2e/%2e%2e/package.json`)).status).toBe(404)
    expect(await (await fetch(`${base}/review`)).text()).toContain("<title>ownship</title>")
  })

  it("/pair sets the cookie and redirects", async () => {
    const res = await fetch(`${base}/pair?token=${TOKEN}`, { redirect: "manual" })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("/")
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain(`ownship_token=${TOKEN}`)
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=Strict")
    const withCookie = await fetch(`${base}/api/session`, {
      headers: { cookie: `ownship_token=${TOKEN}` },
    })
    expect(withCookie.status).toBe(200)
    expect((await fetch(`${base}/pair?token=wrong`, { redirect: "manual" })).status).toBe(401)
  })

  it("survives a request with an unparseable URL", async () => {
    const { port } = new URL(base)
    await new Promise<void>((resolve) => {
      const socket = connect(Number(port), "127.0.0.1", () =>
        socket.end("GET http://[ HTTP/1.1\r\nHost: x\r\n\r\n"),
      )
      socket.on("close", () => resolve())
      socket.on("error", () => resolve())
      socket.resume()
    })
    expect((await fetch(`${base}/api/health`)).status).toBe(200)
  })

  it("sends no CORS headers", async () => {
    const res = await fetch(`${base}/api/session`, {
      headers: { ...auth, origin: "https://evil.example" },
    })
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })

  it("home counts due cards, the next due time and repos", async () => {
    const later = new Date(Date.now() + 3_600_000)
    addCard("x-11111111", later, new Date(Date.now() + 60_000))
    const home = (await get("/api/home")) as {
      due: number
      nextDueAt: string | null
      repos: { slug: string; due: number; lastTurnAt: string }[]
      notes: number
    }
    expect(home.due).toBe(1)
    expect(home.nextDueAt).toBe(later.toISOString())
    expect(home.repos).toEqual([
      expect.objectContaining({ slug: "x-11111111", due: 0 }),
      expect.objectContaining({ slug: "w-00000000", due: 1 }),
    ])
    expect(home.repos[0]!.lastTurnAt > home.repos[1]!.lastTurnAt).toBe(true)
    expect(home.notes).toBe(0)
  })

  it("home on a fresh database has no repos and no next due time", async () => {
    db.exec("DELETE FROM cards")
    expect(await get("/api/home")).toEqual({ due: 0, nextDueAt: null, repos: [], notes: 0 })
  })

  it("session filters by repo", async () => {
    const id = addCard("x-11111111", new Date(Date.now() - 1000))
    const only = (await get("/api/session?repo=x-11111111")) as { cards: { id: number }[] }
    expect(only.cards.map((c) => c.id)).toEqual([id])
    const all = (await get("/api/session")) as { cards: unknown[] }
    expect(all.cards).toHaveLength(2)
  })

  it("notes are listed behind the token", async () => {
    expect((await fetch(`${base}/api/notes`)).status).toBe(401)
    writeNote("w-00000000", card, "Checked in clean().", new Date())
    const body = (await get("/api/notes")) as { notes: { slug: string; text: string }[] }
    expect(body.notes).toHaveLength(1)
    expect(body.notes[0]).toMatchObject({ slug: "w-00000000" })
    expect(body.notes[0]!.text).toContain("Checked in clean().")
  })
})
