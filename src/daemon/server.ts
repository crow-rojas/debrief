import { appendFileSync, existsSync, readFileSync, statSync } from "node:fs"
import http from "node:http"
import { extname, join, resolve, sep } from "node:path"
import type { DatabaseSync } from "node:sqlite"
import type { AgentName } from "../capture/event.ts"
import { grade, type Answer } from "../cards/grade.ts"
import { schedule, type FsrsState } from "../cards/schedule.ts"
import type { CardDraft } from "../cards/types.ts"
import type { Config } from "../config.ts"
import { flagCard } from "../knowledge/notes.ts"
import { homePath } from "../paths.ts"
import { sameToken } from "./token.ts"

export type SessionCard = CardDraft & { id: number; repo: string; endedAt: string }

type Options = {
  token: string
  staticDir: string
  onDoorbell?: (input: { agent: AgentName; transcriptPath?: string }) => void
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
}

function cookie(req: http.IncomingMessage, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=")
    if (key === name) return value.join("=")
  }
  return undefined
}

function send(res: http.ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status).end()
    return
  }
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body))
}

async function json(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ""
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 64_000) throw new Error("body too large")
  }
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

function session(db: DatabaseSync, limit: number, now: Date): SessionCard[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.payload_json, t.slug, t.ended_at FROM cards c JOIN turns t ON t.id = c.turn_id
       WHERE c.state = 'active' AND c.due <= ? ORDER BY (c.fsrs_json IS NULL), c.due LIMIT ?`,
    )
    .all(now.toISOString(), limit) as {
    id: number
    payload_json: string
    slug: string
    ended_at: string
  }[]
  return rows.map((r) => ({
    ...(JSON.parse(r.payload_json) as CardDraft),
    id: r.id,
    repo: r.slug,
    endedAt: r.ended_at,
  }))
}

// Grades and schedules once per reviewId: a retried request returns the first result.
function answer(db: DatabaseSync, cardId: number, reviewId: string, given: Answer, now: Date) {
  const seen = db.prepare("SELECT rating FROM reviews WHERE review_id = ?").get(reviewId) as
    { rating: string } | undefined
  if (seen) return { rating: seen.rating }
  const row = db.prepare("SELECT payload_json, fsrs_json FROM cards WHERE id = ?").get(cardId) as
    { payload_json: string; fsrs_json: string | null } | undefined
  if (!row) return null
  const rating = grade(JSON.parse(row.payload_json) as CardDraft, given)
  const state = schedule(
    row.fsrs_json ? (JSON.parse(row.fsrs_json) as FsrsState) : null,
    rating,
    now,
  )
  db.exec("BEGIN")
  db.prepare("UPDATE cards SET fsrs_json = ?, due = ? WHERE id = ?").run(
    JSON.stringify(state),
    state.due,
    cardId,
  )
  db.prepare(
    "INSERT INTO reviews (review_id, card_id, rating, answered_at) VALUES (?, ?, ?, ?)",
  ).run(reviewId, cardId, rating, now.toISOString())
  db.exec("COMMIT")
  return { rating }
}

function serveStatic(res: http.ServerResponse, staticDir: string, pathname: string): void {
  const root = resolve(staticDir)
  let file: string
  try {
    file = resolve(join(root, decodeURIComponent(pathname)))
  } catch {
    send(res, 400)
    return
  }
  if (file !== root && !file.startsWith(root + sep)) {
    send(res, 404)
    return
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    if (extname(file)) {
      send(res, 404)
      return
    }
    file = join(root, "index.html")
    if (!existsSync(file)) {
      send(res, 404)
      return
    }
  }
  res
    .writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" })
    .end(readFileSync(file))
}

export function createServer(db: DatabaseSync, config: Config, opts: Options): http.Server {
  return http.createServer(async (req, res) => {
    let url: URL
    try {
      url = new URL(req.url ?? "/", "http://ownship.local")
    } catch {
      return send(res, 400)
    }
    res.on("finish", () => {
      try {
        appendFileSync(
          homePath("access.log"),
          `${new Date().toISOString()} ${req.method} ${url.pathname} ${res.statusCode} ${req.socket.remoteAddress}\n`,
        )
      } catch {
        // The access log must never take a request down.
      }
    })
    try {
      if (url.pathname === "/api/health") return send(res, 200, { ok: true })
      if (url.pathname === "/pair") {
        if (!sameToken(url.searchParams.get("token") ?? undefined, opts.token))
          return send(res, 401)
        const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""
        res
          .writeHead(302, {
            location: "/",
            "set-cookie": `ownship_token=${opts.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
          })
          .end()
        return
      }
      if (!url.pathname.startsWith("/api/")) return serveStatic(res, opts.staticDir, url.pathname)

      const bearer = req.headers.authorization?.replace(/^Bearer /, "")
      if (!sameToken(cookie(req, "ownship_token") ?? bearer, opts.token)) return send(res, 401)
      if (req.method === "POST" && req.headers["x-ownship"] !== "1") return send(res, 403)

      const now = new Date()
      if (req.method === "GET" && url.pathname === "/api/settings") {
        return send(res, 200, { language: config.language })
      }
      if (req.method === "GET" && url.pathname === "/api/session") {
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 5) || 5, 50)
        return send(res, 200, { cards: session(db, limit, now) })
      }
      const match = url.pathname.match(/^\/api\/cards\/(\d+)\/(answer|flag)$/)
      if (req.method === "POST" && match) {
        const body = await json(req)
        const cardId = Number(match[1])
        if (match[2] === "answer") {
          if (typeof body.reviewId !== "string" || !body.answer) return send(res, 400)
          const result = answer(db, cardId, body.reviewId, body.answer as Answer, now)
          return result ? send(res, 200, result) : send(res, 404)
        }
        const action = body.action === "regenerate" ? "regenerate" : "discard"
        flagCard(
          db,
          cardId,
          { note: typeof body.note === "string" ? body.note : undefined, action },
          now,
        )
        return send(res, 204)
      }
      if (req.method === "POST" && url.pathname === "/api/doorbell") {
        const body = await json(req)
        const agent = body.agent === "codex" ? "codex" : "claude-code"
        opts.onDoorbell?.({
          agent,
          transcriptPath: typeof body.transcriptPath === "string" ? body.transcriptPath : undefined,
        })
        return send(res, 202)
      }
      return send(res, 404)
    } catch (error) {
      return send(res, 500, { error: (error as Error).message })
    }
  })
}
