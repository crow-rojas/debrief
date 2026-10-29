// @vitest-environment happy-dom
import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import { afterEach, describe, expect, it } from "vitest"
import App from "../../app/App.vue"
import HomeView from "../../app/components/HomeView.vue"
import SessionView from "../../app/components/SessionView.vue"

const mountApp = () =>
  mount(App, { global: { stubs: { HomeView: true, SessionView: true, NotesView: true } } })

const go = async (hash: string) => {
  location.hash = hash
  window.dispatchEvent(new HashChangeEvent("hashchange"))
  await nextTick()
}

describe("App", () => {
  afterEach(() => {
    location.hash = ""
  })

  it("routes by hash", async () => {
    location.hash = "#/session?repo=api-1234abcd"
    const wrapper = mountApp()
    expect(wrapper.findComponent(SessionView).props("repo")).toBe("api-1234abcd")
    await go("#/")
    expect(wrapper.findComponent(HomeView).exists()).toBe(true)
    expect(wrapper.findComponent(SessionView).exists()).toBe(false)
    await go("#/session")
    expect(wrapper.findComponent(SessionView).props("repo")).toBeUndefined()
    await go("#/whatever")
    expect(wrapper.findComponent(HomeView).exists()).toBe(true)
  })
})
