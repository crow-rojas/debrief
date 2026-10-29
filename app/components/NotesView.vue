<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { getNotes, NotPairedError, type Note } from "../api.ts"
import { repoName } from "../repo.ts"
import EmptyState from "./EmptyState.vue"

const { t } = useI18n()
const notes = ref<Note[]>([])
const state = ref<"loading" | "ready" | "unpaired" | "error">("loading")

onMounted(async () => {
  try {
    notes.value = await getNotes()
    state.value = "ready"
  } catch (error) {
    state.value = error instanceof NotPairedError ? "unpaired" : "error"
  }
})
</script>

<template>
  <section class="notes">
    <a class="link back" href="#/">{{ t("app.notes.back") }}</a>
    <h1>{{ t("app.notes.title") }}</h1>
    <EmptyState v-if="state !== 'ready'" :variant="state" />
    <p v-else-if="notes.length === 0" class="empty">{{ t("app.notes.empty") }}</p>
    <template v-else>
      <article v-for="note in notes" :key="`${note.slug}/${note.file}`" class="note">
        <p class="home-row-meta">{{ repoName(note.slug) }}</p>
        <div class="note-text">{{ note.text }}</div>
      </article>
    </template>
  </section>
</template>
