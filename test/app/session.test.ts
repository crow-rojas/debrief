// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionCard } from "../../app/api.ts"
import SessionView from "../../app/components/SessionView.vue"
import { makeI18n } from "../../app/i18n/index.ts"

const api = vi.hoisted(() => ({ getSession: vi.fn(), answer: vi.fn(), flag: vi.fn() }))
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

const mountSession = async () => {
  const wrapper = mount(SessionView, { global: { plugins: [makeI18n("en")] } })
  await flushPromises()
  return wrapper
}

describe("SessionView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getSession.mockResolvedValue([choice(1), choice(2)])
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

  it('"Not now" removes the card without calling answer', async () => {
    const wrapper = await mountSession()
    await wrapper.find("[data-test=not-now]").trigger("click")
    expect(api.answer).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain("Question 2?")
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

  it("shows the empty state when the session runs out", async () => {
    api.getSession.mockResolvedValue([])
    const wrapper = await mountSession()
    expect(wrapper.text()).toContain("You're all caught up")
  })
})
