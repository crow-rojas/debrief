// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionCard } from "../../app/api.ts"
import SessionView from "../../app/components/SessionView.vue"
import { makeI18n } from "../../app/i18n/index.ts"
import { skipped } from "../../app/skipped.ts"

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  getHome: vi.fn(),
  answer: vi.fn(),
  flag: vi.fn(),
}))
vi.mock("../../app/api.ts", () => ({ ...api, NotPairedError: class extends Error {} }))

const choice = (id: number): SessionCard => ({
  id,
  repo: "api-1234abcd",
  endedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  kind: "choice",
  question: `Question ${id}?`,
  explanation: "Because.",
  evidence: [
    { source: "patch", quote: "with transaction.atomic():", path: "app/importer.py", line: 88 },
  ],
  options: ["a", "b", "c"],
  correct: 1,
})

const mountSession = async (props: { repo?: string } = {}) => {
  const wrapper = mount(SessionView, { props, global: { plugins: [makeI18n("en")] } })
  await flushPromises()
  return wrapper
}

const home = (due: number, repos: { slug: string; due: number }[] = []) => ({
  due,
  nextDueAt: null,
  repos: repos.map((r) => ({ ...r, lastTurnAt: new Date().toISOString() })),
  notes: 0,
})

const answerCurrent = async (wrapper: Awaited<ReturnType<typeof mountSession>>) => {
  await wrapper.findAll("[data-test=option]")[1]!.trigger("click")
  await wrapper.find("[data-test=next]").trigger("click")
  await flushPromises()
}

describe("SessionView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    skipped.clear()
    location.hash = ""
    api.getSession.mockResolvedValue([choice(1), choice(2)])
    api.getHome.mockResolvedValue(home(0))
    api.answer.mockResolvedValue({ rating: "good" })
    api.flag.mockResolvedValue(undefined)
  })

  it("shows the question with its evidence and answers it", async () => {
    const wrapper = await mountSession()
    expect(wrapper.text()).toContain("Question 1?")
    expect(wrapper.find("pre").text()).toContain("with transaction.atomic():")
    await wrapper.findAll("[data-test=option]")[1]!.trigger("click")
    await wrapper.find("[data-test=next]").trigger("click")
    await flushPromises()
    expect(api.answer).toHaveBeenCalledWith(1, { kind: "choice", picked: 1 })
    expect(wrapper.text()).toContain("Question 2?")
  })

  it("waits for the last answer to be saved before showing the end screen", async () => {
    api.getSession.mockResolvedValue([choice(1)])
    let save!: (value: unknown) => void
    api.answer.mockReturnValue(new Promise((resolve) => (save = resolve)))
    const wrapper = await mountSession()
    await answerCurrent(wrapper)
    expect(wrapper.find("[data-test=session-end]").exists()).toBe(false)
    expect(api.getHome).not.toHaveBeenCalled()
    save({ rating: "good" })
    await flushPromises()
    expect(wrapper.find("[data-test=session-end]").exists()).toBe(true)
    expect(api.getSession).toHaveBeenCalledTimes(1)
  })

  it('"Not now" removes the card without calling answer', async () => {
    const wrapper = await mountSession()
    await wrapper.find("[data-test=not-now]").trigger("click")
    expect(api.answer).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("Question 2?")
  })

  it("keeps Not now and the flag in the top bar, and opens the flag form above the question", async () => {
    const wrapper = await mountSession()
    const top = wrapper.find("header")
    expect(top.find("[data-test=not-now]").exists()).toBe(true)
    expect(top.find("[data-test=flag]").attributes("aria-label")).toBe("This card is wrong")
    await top.find("[data-test=flag]").trigger("click")
    const html = wrapper.html()
    expect(html.indexOf('data-test="flag-note"')).toBeLessThan(html.indexOf("Question 1?"))
  })

  it("flagging with a note calls flag with action regenerate", async () => {
    const wrapper = await mountSession()
    await wrapper.find("[data-test=flag]").trigger("click")
    await wrapper.find("[data-test=flag-note]").setValue("The import validates rows one by one.")
    await wrapper.find("[data-test=flag-regenerate]").trigger("click")
    await flushPromises()
    expect(api.flag).toHaveBeenCalledWith(1, {
      note: "The import validates rows one by one.",
      action: "regenerate",
    })
    expect(wrapper.text()).toContain("Question 2?")
  })

  it("tells the user when an answer could not be saved and keeps the card", async () => {
    api.answer.mockRejectedValue(new Error("offline"))
    const wrapper = await mountSession()
    await wrapper.findAll("[data-test=option]")[1]!.trigger("click")
    await wrapper.find("[data-test=next]").trigger("click")
    await flushPromises()
    expect(wrapper.find("[data-test=save-failed]").exists()).toBe(true)
    expect(wrapper.text()).toContain("Question 1?")
  })

  it("keeps its total and shows the end screen instead of loading more", async () => {
    api.answer.mockResolvedValueOnce({ rating: "good" }).mockResolvedValueOnce({ rating: "again" })
    const wrapper = await mountSession()
    await answerCurrent(wrapper)
    expect(wrapper.text()).toContain("2 of 2")
    await answerCurrent(wrapper)
    expect(api.getSession).toHaveBeenCalledTimes(1)
    const end = wrapper.find("[data-test=session-end]")
    expect(end.text()).toContain("You reviewed 2 cards")
    expect(end.text()).toContain("1 right the first time")
    expect(end.text()).toContain("1 comes back soon")
  })

  it("continue starts a new session in the same scope", async () => {
    api.getHome.mockResolvedValue(home(3, [{ slug: "api-1234abcd", due: 3 }]))
    const wrapper = await mountSession({ repo: "api-1234abcd" })
    await answerCurrent(wrapper)
    await answerCurrent(wrapper)
    expect(api.getSession).toHaveBeenLastCalledWith(5, "api-1234abcd")
    await wrapper.find("[data-test=continue]").trigger("click")
    await flushPromises()
    expect(api.getSession).toHaveBeenCalledTimes(2)
    expect(api.getSession).toHaveBeenLastCalledWith(5, "api-1234abcd")
    expect(wrapper.text()).toContain("1 of 2")
  })

  it("still due leaves out cards skipped this visit", async () => {
    api.getHome.mockResolvedValue(home(1))
    const wrapper = await mountSession()
    await wrapper.find("[data-test=not-now]").trigger("click")
    await answerCurrent(wrapper)
    expect(wrapper.find("[data-test=session-end]").exists()).toBe(true)
    expect(wrapper.find("[data-test=continue]").exists()).toBe(false)
  })

  it("a failed save keeps the card and the total", async () => {
    api.getSession.mockResolvedValue([choice(1)])
    api.answer.mockRejectedValueOnce(new Error("offline"))
    const wrapper = await mountSession()
    await answerCurrent(wrapper)
    expect(wrapper.find("[data-test=save-failed]").exists()).toBe(true)
    expect(wrapper.text()).toContain("Question 1?")
    expect(wrapper.text()).toContain("1 of 1")
    expect(wrapper.find("[data-test=session-end]").exists()).toBe(false)
    await answerCurrent(wrapper)
    expect(wrapper.find("[data-test=session-end]").exists()).toBe(true)
  })

  it("an empty session goes home without a history entry", async () => {
    api.getSession.mockResolvedValue([])
    const before = history.length
    await mountSession()
    expect(location.hash).toBe("#/")
    expect(history.length).toBe(before)
  })

  it("the end screen's home button replaces the session in history", async () => {
    api.getSession.mockResolvedValue([choice(1)])
    const wrapper = await mountSession()
    await answerCurrent(wrapper)
    const before = history.length
    await wrapper.find("[data-test=home]").trigger("click")
    expect(location.hash).toBe("#/")
    expect(history.length).toBe(before)
  })

  it("an unknown still-due count offers no next session and claims nothing", async () => {
    api.getSession.mockResolvedValue([choice(1)])
    api.getHome.mockRejectedValue(new Error("offline"))
    const wrapper = await mountSession()
    await answerCurrent(wrapper)
    const end = wrapper.find("[data-test=session-end]")
    expect(end.exists()).toBe(true)
    expect(end.text()).not.toContain("Nothing else is due")
    expect(wrapper.find("[data-test=continue]").exists()).toBe(false)
  })

  it("shows loading, not a blank screen, while the end screen waits", async () => {
    api.getSession.mockResolvedValue([choice(1)])
    api.answer.mockReturnValue(new Promise(() => {}))
    const wrapper = await mountSession()
    await answerCurrent(wrapper)
    expect(wrapper.text()).toContain("Loading")
  })
})
