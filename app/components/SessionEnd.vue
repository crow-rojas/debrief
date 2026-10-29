<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps<{
  reviewed: number
  right: number
  again: number
  stillDue: number | null
}>()
const emit = defineEmits<{ continue: []; home: [] }>()
const { t } = useI18n()
// The next session holds up to 5 cards, like SessionView.
const next = computed(() => Math.min(5, props.stillDue ?? 0))
</script>

<template>
  <section class="empty end" data-test="session-end" aria-live="polite">
    <h1>{{ t("app.end.title", { n: reviewed }, reviewed) }}</h1>
    <p>{{ t("app.end.right", { n: right }) }}</p>
    <p>{{ t("app.end.again", { n: again }, again) }}</p>
    <p v-if="stillDue !== null">{{ t("app.end.stillDue", { n: stillDue }, stillDue) }}</p>
    <button
      v-if="next > 0"
      type="button"
      class="primary"
      data-test="continue"
      @click="emit('continue')"
    >
      {{ t("app.end.continue", { n: next }, next) }}
    </button>
    <button type="button" class="secondary" data-test="home" @click="emit('home')">
      {{ t("app.end.home") }}
    </button>
  </section>
</template>
