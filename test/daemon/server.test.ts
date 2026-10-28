import { mkdtempSync, writeFileSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { CardDraft } from "../../src/cards/types.ts"
import { loadConfig } from "../../src/config.ts"
import { createServer } from "../../src/daemon/server.ts"
import { openDb } from "../../src/db.ts"
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

  it("sends no CORS headers", async () => {
    const res = await fetch(`${base}/api/session`, {
      headers: { ...auth, origin: "https://evil.example" },
    })
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })
})
