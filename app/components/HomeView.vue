<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { ago } from "../ago.ts"
import { getHome, NotPairedError, type HomeSummary } from "../api.ts"
import { repoName } from "../repo.ts"
import { skippedIn } from "../skipped.ts"
import EmptyState from "./EmptyState.vue"

const { t, locale } = useI18n()
const summary = ref<HomeSummary | null>(null)
// "Not now" cards stay due on the server; the home leaves them out, as the session does.
const home = computed(
  () =>
    summary.value && {
      ...summary.value,
      due: Math.max(0, summary.value.due - skippedIn()),
      repos: summary.value.repos.map((r) => ({
        ...r,
        due: Math.max(0, r.due - skippedIn(r.slug)),
      })),
    },
)
const state = ref<"loading" | "ready" | "unpaired" | "error">("loading")
// A session holds up to 5 cards, like SessionView.
const first = computed(() => Math.min(5, home.value?.due ?? 0))

onMounted(async () => {
  try {
    summary.value = await getHome()
    state.value = "ready"
  } catch (error) {
    state.value = error instanceof NotPairedError ? "unpaired" : "error"
  }
})
</script>

<template>
  <EmptyState v-if="state !== 'ready' || !home" :variant="state === 'ready' ? 'error' : state" />
  <section v-else class="home">
    <div class="empty">
      <template v-if="home.due > 0">
        <h1>{{ t("app.home.due", { n: home.due }, home.due) }}</h1>
        <a class="button primary" href="#/session">{{
          t("app.home.start", { n: first }, first)
        }}</a>
      </template>
      <template v-else>
        <h1>{{ t("app.empty.title") }}</h1>
        <p v-if="home.nextDueAt" data-test="next">
          {{ t("app.home.next", { when: ago(home.nextDueAt, locale) }) }}
        </p>
        <p v-else>{{ t("app.empty.body") }}</p>
      </template>
    </div>
    <template v-if="home.repos.length > 0">
      <h2 class="home-label">{{ t("app.home.repos") }}</h2>
      <ul class="rows">
        <li v-for="repo in home.repos" :key="repo.slug">
          <component
            :is="repo.due > 0 ? 'a' : 'div'"
            class="home-row"
            :href="repo.due > 0 ? `#/session?repo=${encodeURIComponent(repo.slug)}` : undefined"
          >
            <span class="home-row-name">{{ repoName(repo.slug) }}</span>
            <span class="home-row-meta">{{
              t("app.home.lastTurn", {
                due: t("app.home.repoDue", { n: repo.due }, repo.due),
                ago: ago(repo.lastTurnAt, locale),
              })
            }}</span>
          </component>
        </li>
      </ul>
    </template>
    <a class="home-row" href="#/notes">
      <span class="home-row-name">{{ t("app.home.notes") }}</span>
      <span class="home-row-meta">{{
        t("app.home.notesCount", { n: home.notes }, home.notes)
      }}</span>
    </a>
  </section>
</template>
