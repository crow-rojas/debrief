<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import type { FlagInput, SessionCard } from "../api.ts"
import { ago as since } from "../ago.ts"
import { repoName } from "../repo.ts"
import FlagSheet from "./FlagSheet.vue"

const props = defineProps<{ card: SessionCard; position: number; total: number }>()
const emit = defineEmits<{ notNow: []; flag: [input: FlagInput] }>()
const { t, locale } = useI18n()
const flagging = ref(false)

const ago = computed(() => since(props.card.endedAt, locale.value))
const repo = computed(() => repoName(props.card.repo))
const code = computed(() => props.card.evidence.filter((e) => e.source === "patch"))
const quotes = computed(() => props.card.evidence.filter((e) => e.source !== "patch"))
const kind = computed(() => {
  switch (props.card.kind) {
    case "defend":
      return t("app.kind.defend")
    case "choice":
      return t("app.kind.choice")
    case "text":
      return t("app.kind.text")
    default:
      return t("app.kind.number")
  }
})
</script>

<template>
  <article class="card">
    <header class="card-top">
      <span>{{ t("app.card.meta", { repo, ago }) }}</span>
      <span class="card-actions">
        <span>{{ t("app.progress", { n: position, total }) }}</span>
        <button type="button" class="link" data-test="not-now" @click="emit('notNow')">
          {{ t("app.card.notNow") }}
        </button>
        <button
          type="button"
          class="link danger flag"
          data-test="flag"
          :aria-label="t('app.card.wrong')"
          :title="t('app.card.wrong')"
          :aria-expanded="flagging"
          @click="flagging = !flagging"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 21V4h11l-1.5 4L16 12H7v9z" fill="currentColor" />
          </svg>
        </button>
      </span>
    </header>
    <FlagSheet v-if="flagging" @cancel="flagging = false" @submit="emit('flag', $event)" />
    <p class="kind">{{ kind }}</p>
    <h1 class="question">{{ card.question }}</h1>
    <figure v-for="(e, i) in code" :key="`c${i}`" class="evidence">
      <figcaption v-if="e.path">{{ e.path }}</figcaption>
      <pre><code><span v-for="(line, j) in e.quote.split('\n')" :key="j" class="hl">{{ line }}</span></code></pre>
    </figure>
    <blockquote v-for="(e, i) in quotes" :key="`q${i}`" class="quote">
      <span class="quote-source">{{
        e.source === "prompt" ? t("app.card.fromPrompt") : t("app.card.fromMessage")
      }}</span>
      {{ e.quote }}
    </blockquote>
    <slot />
  </article>
</template>
