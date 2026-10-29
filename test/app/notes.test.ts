// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotPairedError } from "../../app/api.ts"
import NotesView from "../../app/components/NotesView.vue"
import { makeI18n } from "../../app/i18n/index.ts"

const api = vi.hoisted(() => ({ getNotes: vi.fn() }))
vi.mock("../../app/api.ts", () => ({ ...api, NotPairedError: class extends Error {} }))

const mountNotes = async () => {
  const wrapper = mount(NotesView, { global: { plugins: [makeI18n("en")] } })
  await flushPromises()
  return wrapper
}

describe("NotesView", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lists notes with their repo", async () => {
    api.getNotes.mockResolvedValue([
      { slug: "api-1234abcd", file: "b.md", text: "# Newer\n\nImports skip it." },
      { slug: "web-87654321", file: "a.md", text: "# Older" },
    ])
    const wrapper = await mountNotes()
    const text = wrapper.text()
    expect(text).toContain("Imports skip it.")
    expect(text.indexOf("Newer")).toBeLessThan(text.indexOf("Older"))
    expect(text).toContain("api")
    expect(text).not.toContain("1234abcd")
    expect(wrapper.find("a").attributes("href")).toBe("#/")
  })

  it("says so when there are no notes", async () => {
    api.getNotes.mockResolvedValue([])
    const wrapper = await mountNotes()
    expect(wrapper.text()).toContain("No notes yet")
  })

  it("unpaired shows the pairing message", async () => {
    api.getNotes.mockRejectedValue(new NotPairedError())
    const wrapper = await mountNotes()
    expect(wrapper.text()).toContain("This device isn't paired")
  })

  it("an unreachable daemon shows the error", async () => {
    api.getNotes.mockRejectedValue(new Error("offline"))
    const wrapper = await mountNotes()
    expect(wrapper.text()).toContain("Couldn't load")
  })
})
