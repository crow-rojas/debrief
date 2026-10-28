// @vitest-environment happy-dom
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import DefendCard from "../../app/components/kinds/DefendCard.vue"
import { makeI18n } from "../../app/i18n/index.ts"
import type { SessionCard } from "../../app/api.ts"

const card: SessionCard = {
  id: 1,
  repo: "api-1234abcd",
  endedAt: new Date().toISOString(),
  kind: "defend",
  question: "Why does the RUT check live in clean()?",
  explanation: "Every creation path calls full_clean().",
  evidence: [],
  keyIdeas: ["The import skips the serializer", "clean() runs on every path"],
}

const mountCard = () =>
  mount(DefendCard, { props: { card }, global: { plugins: [makeI18n("en")] } })

describe("DefendCard", () => {
  it("sends good only when every key idea is ticked", async () => {
    const wrapper = mountCard()
    await wrapper.find("textarea").setValue("Because the Excel import never uses the serializer")
    await wrapper.find("[data-test=reveal]").trigger("click")
    const boxes = wrapper.findAll("input[type=checkbox]")
    expect(boxes).toHaveLength(2)
    await boxes[0]!.setValue(true)
    await boxes[1]!.setValue(true)
    await wrapper.find("[data-test=next]").trigger("click")
    expect(wrapper.emitted("done")?.[0]).toEqual([
      {
        kind: "defend",
        text: "Because the Excel import never uses the serializer",
        ticked: [0, 1],
      },
    ])
  })

  it('"I don\'t know" sends dontKnow', async () => {
    const wrapper = mountCard()
    await wrapper.find("[data-test=dont-know]").trigger("click")
    await wrapper.find("[data-test=next]").trigger("click")
    expect(wrapper.emitted("done")?.[0]).toEqual([{ kind: "dontKnow" }])
  })
})
