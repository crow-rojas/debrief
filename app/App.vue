<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import HomeView from "./components/HomeView.vue"
import NotesView from "./components/NotesView.vue"
import SessionView from "./components/SessionView.vue"

// ponytail: hash routes and the hashchange event, so the back button works without a router.
const hash = ref(location.hash)
const onHashChange = () => (hash.value = location.hash)
onMounted(() => window.addEventListener("hashchange", onHashChange))
onUnmounted(() => window.removeEventListener("hashchange", onHashChange))

const route = computed(() => {
  const [path, query = ""] = hash.value.replace(/^#/, "").split("?")
  if (path === "/session") {
    return { view: "session", repo: new URLSearchParams(query).get("repo") ?? undefined }
  }
  if (path === "/notes") return { view: "notes" }
  return { view: "home" }
})
</script>

<template>
  <main class="shell">
    <SessionView v-if="route.view === 'session'" :key="hash" :repo="route.repo" />
    <NotesView v-else-if="route.view === 'notes'" />
    <HomeView v-else />
  </main>
</template>
