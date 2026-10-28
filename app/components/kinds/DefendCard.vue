<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import type { Answer } from "../../../src/cards/grade.ts"
import type { SessionCard } from "../../api.ts"

const props = defineProps<{ card: SessionCard & { kind: "defend" } }>()
const emit = defineEmits<{ done: [answer: Answer] }>()
const { t } = useI18n()
const text = ref("")
const revealed = ref(false)
const dontKnow = ref(false)
const ticked = ref<number[]>([])

function giveUp() {
  dontKnow.value = true
  revealed.value = true
}
function next() {
  emit(
    "done",
    dontKnow.value
      ? { kind: "dontKnow" }
      : { kind: "defend", text: text.value, ticked: [...ticked.value].sort() },
  )
}
</script>

<template>
  <div class="answer">
    <template v-if="!revealed">
      <textarea v-model="text" rows="4" :placeholder="t('app.defend.placeholder')" />
      <button
        type="button"
        class="primary"
        data-test="reveal"
        :disabled="!text.trim()"
        @click="revealed = true"
      >
        {{ t("app.defend.reveal") }}
      </button>
      <button type="button" class="link" data-test="dont-know" @click="giveUp">
        {{ t("app.card.dontKnow") }}
      </button>
    </template>
    <template v-else>
      <p v-if="text" class="mine">{{ text }}</p>
      <template v-if="!dontKnow">
        <p class="hint">{{ t("app.defend.tick") }}</p>
        <label v-for="(idea, i) in props.card.keyIdeas" :key="i" class="idea">
          <input v-model="ticked" type="checkbox" :value="i" />
          <span>{{ idea }}</span>
        </label>
      </template>
      <ul v-else class="ideas">
        <li v-for="(idea, i) in props.card.keyIdeas" :key="i">{{ idea }}</li>
      </ul>
      <p class="why">{{ props.card.explanation }}</p>
      <button type="button" class="primary" data-test="next" @click="next">
        {{ t("app.card.next") }}
      </button>
    </template>
  </div>
</template>
