<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { grade, type Answer } from "../../../src/cards/grade.ts"
import type { SessionCard } from "../../api.ts"

const props = defineProps<{ card: SessionCard & { kind: "number" } }>()
const emit = defineEmits<{ done: [answer: Answer] }>()
const { t, n } = useI18n()
const value = ref<number | "">("")
const given = ref<Answer | null>(null)
const right = computed(() => given.value !== null && grade(props.card, given.value) === "good")
</script>

<template>
  <div class="answer">
    <form
      v-if="!given"
      class="row"
      @submit.prevent="given = { kind: 'number', value: Number(value) }"
    >
      <input
        v-model="value"
        type="number"
        step="any"
        inputmode="decimal"
        :placeholder="t('app.number.placeholder')"
      />
      <button type="submit" class="primary" :disabled="value === ''">
        {{ t("app.card.check") }}
      </button>
    </form>
    <button v-if="!given" type="button" class="link" @click="given = { kind: 'dontKnow' }">
      {{ t("app.card.dontKnow") }}
    </button>
    <template v-else>
      <p class="verdict" :class="right ? 'right' : 'wrong'">
        {{ right ? t("app.card.right") : t("app.card.notQuite") }}
      </p>
      <p v-if="!right">{{ t("app.card.accepted", { answer: n(props.card.value) }) }}</p>
      <p class="why">{{ props.card.explanation }}</p>
      <button type="button" class="primary" data-test="next" @click="emit('done', given)">
        {{ t("app.card.next") }}
      </button>
    </template>
  </div>
</template>
