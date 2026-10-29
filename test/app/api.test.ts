// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { answer } from "../../app/api.ts"

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
