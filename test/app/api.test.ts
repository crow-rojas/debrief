// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { answer, getHome, getNotes, getSession } from "../../app/api.ts"
import { repoName } from "../../app/repo.ts"

describe("api.answer", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("works without crypto.randomUUID, which plain-HTTP LAN pages lack", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    })
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ rating: "good" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    expect(await answer(1, { kind: "choice", picked: 0 })).toEqual({ rating: "good" })
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(body.reviewId).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe("api reads", () => {
  afterEach(() => vi.unstubAllGlobals())

  const stub = (body: unknown) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    return () => fetchMock.mock.calls.map((c) => (c as unknown as [string])[0])
  }

  it("getSession passes the repo, encoded", async () => {
    const urls = stub({ cards: [] })
    await getSession(5, "a b-12345678")
    await getSession()
    expect(urls()).toEqual(["/api/session?limit=5&repo=a%20b-12345678", "/api/session?limit=5"])
  })

  it("getHome and getNotes read their routes", async () => {
    const home = { due: 1, nextDueAt: null, repos: [], notes: 0 }
    let urls = stub(home)
    expect(await getHome()).toEqual(home)
    expect(urls()).toEqual(["/api/home"])
    const notes = [{ slug: "a-12345678", file: "n.md", text: "# Q" }]
    urls = stub({ notes })
    expect(await getNotes()).toEqual(notes)
    expect(urls()).toEqual(["/api/notes"])
  })
})

describe("repoName", () => {
  it("repoName strips only the hash suffix", () => {
    expect(repoName("todo-app-1a2b3c4d")).toBe("todo-app")
    expect(repoName("todo-app")).toBe("todo-app")
  })
})
