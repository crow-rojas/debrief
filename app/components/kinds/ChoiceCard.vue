<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import type { Answer } from "../../../src/cards/grade.ts"
import type { SessionCard } from "../../api.ts"

const props = defineProps<{ card: SessionCard & { kind: "choice" } }>()
const emit = defineEmits<{ done: [answer: Answer] }>()
const { t } = useI18n()
const picked = ref<number | null>(null)

const state = (i: number) =>
  picked.value === null
    ? ""
    : i === props.card.correct
      ? "right"
      : i === picked.value
        ? "wrong"
        : ""
</script>

<template>
  <div class="answer">
    <button
      v-for="(option, i) in props.card.options"
      :key="i"
      type="button"
      class="option"
      :class="state(i)"
      :disabled="picked !== null"
      data-test="option"
      @click="picked = i"
    >
      {{ option }}
    </button>
    <template v-if="picked !== null">
      <p class="verdict" :class="picked === props.card.correct ? 'right' : 'wrong'">
        {{ picked === props.card.correct ? t("app.card.right") : t("app.card.notQuite") }}
      </p>
      <p class="why">{{ props.card.explanation }}</p>
      <button
        type="button"
        class="primary"
        data-test="next"
        @click="emit('done', { kind: 'choice', picked })"
      >
        {{ t("app.card.next") }}
      </button>
    </template>
  </div>
</template>
