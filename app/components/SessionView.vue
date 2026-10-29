<script setup lang="ts">
import { computed, onMounted, ref, type Component } from "vue"
import { useI18n } from "vue-i18n"
import type { Answer } from "../../src/cards/grade.ts"
import {
  answer,
  flag,
  getSession,
  NotPairedError,
  type FlagInput,
  type SessionCard,
} from "../api.ts"
import CardShell from "./CardShell.vue"
import EmptyState from "./EmptyState.vue"
import ChoiceCard from "./kinds/ChoiceCard.vue"
import DefendCard from "./kinds/DefendCard.vue"
import NumberCard from "./kinds/NumberCard.vue"
import TextCard from "./kinds/TextCard.vue"

const KINDS: Record<SessionCard["kind"], Component> = {
  defend: DefendCard,
  choice: ChoiceCard,
  text: TextCard,
  number: NumberCard,
}

const { t } = useI18n()
const cards = ref<SessionCard[]>([])
const saveFailed = ref(false)
const done = ref(0)
const state = ref<"loading" | "ready" | "unpaired" | "error">("loading")
// "Not now" only hides a card for this visit; it stays due on the server.
const skipped = new Set<number>()
// Answers and flags still on their way: a reload waits for them, or the server would hand the
// card that was just answered back as still due.
const saving = new Set<Promise<unknown>>()
const current = computed(() => cards.value[0])

async function load() {
  await Promise.allSettled([...saving])
  try {
    cards.value = (await getSession()).filter((c) => !skipped.has(c.id))
    state.value = "ready"
  } catch (error) {
    state.value = error instanceof NotPairedError ? "unpaired" : "error"
  }
}

function advance() {
  cards.value = cards.value.slice(1)
  done.value++
  if (cards.value.length === 0) void load()
}

async function onDone(given: Answer) {
  const card = current.value
  if (!card) return
  const saved = answer(card.id, given)
  saving.add(saved)
  advance()
  try {
    await saved
    saveFailed.value = false
  } catch (error) {
    if (error instanceof NotPairedError) state.value = "unpaired"
    else {
      // Put the card back so the answer can be given again once the daemon is reachable.
      cards.value = [card, ...cards.value.filter((c) => c.id !== card.id)]
      done.value--
      saveFailed.value = true
    }
  } finally {
    saving.delete(saved)
  }
}

function onNotNow() {
  if (current.value) skipped.add(current.value.id)
  advance()
}

async function onFlag(input: FlagInput) {
  const card = current.value
  if (!card) return
  const saved = flag(card.id, input).catch(() => {})
  saving.add(saved)
  advance()
  await saved
  saving.delete(saved)
}

onMounted(load)
</script>

<template>
  <p v-if="saveFailed" class="banner" role="alert" data-test="save-failed">
    {{ t("app.saveFailed") }}
  </p>
  <EmptyState v-if="state !== 'ready' || !current" :variant="state === 'ready' ? 'empty' : state" />
  <CardShell
    v-else
    :key="current.id"
    :card="current"
    :position="done + 1"
    :total="done + cards.length"
    @not-now="onNotNow"
    @flag="onFlag"
  >
    <component :is="KINDS[current.kind]" :card="current" @done="onDone" />
  </CardShell>
</template>
