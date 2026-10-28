<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { grade, type Answer } from "../../../src/cards/grade.ts"
import type { SessionCard } from "../../api.ts"

const props = defineProps<{ card: SessionCard & { kind: "text" } }>()
const emit = defineEmits<{ done: [answer: Answer] }>()
const { t } = useI18n()
const text = ref("")
const given = ref<Answer | null>(null)
const right = computed(() => given.value !== null && grade(props.card, given.value) === "good")
</script>

<template>
  <div class="answer">
    <form v-if="!given" class="row" @submit.prevent="given = { kind: 'text', text }">
      <input
        v-model="text"
        type="text"
        :placeholder="t('app.text.placeholder')"
        autocomplete="off"
      />
      <button type="submit" class="primary" :disabled="!text.trim()">
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
      <p v-if="!right">{{ t("app.card.accepted", { answer: props.card.accepted[0] }) }}</p>
      <p class="why">{{ props.card.explanation }}</p>
      <button type="button" class="primary" data-test="next" @click="emit('done', given)">
        {{ t("app.card.next") }}
      </button>
    </template>
  </div>
</template>
