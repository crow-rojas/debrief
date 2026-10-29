// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotPairedError } from "../../app/api.ts"
import HomeView from "../../app/components/HomeView.vue"
import { makeI18n } from "../../app/i18n/index.ts"

const api = vi.hoisted(() => ({ getHome: vi.fn() }))
vi.mock("../../app/api.ts", () => ({ ...api, NotPairedError: class extends Error {} }))

const ago = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

const mountHome = async () => {
  const wrapper = mount(HomeView, { global: { plugins: [makeI18n("en")] } })
  await flushPromises()
  return wrapper
}

const hrefs = (wrapper: Awaited<ReturnType<typeof mountHome>>) =>
  wrapper.findAll("a").map((a) => a.attributes("href"))

describe("HomeView", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows what is due and links to a session", async () => {
    api.getHome.mockResolvedValue({
      due: 8,
      nextDueAt: null,
      repos: [
        { slug: "api-1234abcd", due: 5, lastTurnAt: ago(-120) },
        { slug: "web-87654321", due: 3, lastTurnAt: ago(-60 * 24) },
      ],
      notes: 2,
    })
    const wrapper = await mountHome()
    const text = wrapper.text()
    expect(text).toContain("8 cards to review")
    expect(text).toContain("api")
    expect(text).toContain("web")
    expect(text).not.toContain("1234abcd")
    expect(text).toContain("2 hours ago")
    expect(hrefs(wrapper)).toEqual(
      expect.arrayContaining(["#/session", "#/session?repo=api-1234abcd", "#/notes"]),
    )
  })

  it("a repo with nothing due is listed but not a link", async () => {
    api.getHome.mockResolvedValue({
      due: 1,
      nextDueAt: null,
      repos: [
        { slug: "api-1234abcd", due: 1, lastTurnAt: ago(-5) },
        { slug: "web-87654321", due: 0, lastTurnAt: ago(-60) },
      ],
      notes: 0,
    })
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain("web")
    expect(hrefs(wrapper)).not.toContain("#/session?repo=web-87654321")
    expect(hrefs(wrapper)).toContain("#/session?repo=api-1234abcd")
  })

  it("caught up shows when the next card is due", async () => {
    api.getHome.mockResolvedValue({
      due: 0,
      nextDueAt: ago(180),
      repos: [{ slug: "api-1234abcd", due: 0, lastTurnAt: ago(-5) }],
      notes: 0,
    })
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain("You're all caught up")
    expect(wrapper.text()).toContain("in 3 hours")
    expect(hrefs(wrapper)).not.toContain("#/session")
  })

  it("caught up on a fresh install has no next line", async () => {
    api.getHome.mockResolvedValue({ due: 0, nextDueAt: null, repos: [], notes: 0 })
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain("You're all caught up")
    expect(wrapper.find("[data-test=next]").exists()).toBe(false)
  })

  it("unpaired shows the pairing message", async () => {
    api.getHome.mockRejectedValue(new NotPairedError())
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain("This device isn't paired")
  })

  it("an unreachable daemon shows the error", async () => {
    api.getHome.mockRejectedValue(new Error("offline"))
    const wrapper = await mountHome()
    expect(wrapper.text()).toContain("Couldn't load cards")
  })
})
