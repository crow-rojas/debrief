<script setup lang="ts">
import { computed, onMounted, ref, type Component } from "vue"
import { useI18n } from "vue-i18n"
import type { Answer } from "../../src/cards/grade.ts"
import {
  answer,
  flag,
  getHome,
  getSession,
  NotPairedError,
  type FlagInput,
  type SessionCard,
} from "../api.ts"
import { skipped } from "../skipped.ts"
import CardShell from "./CardShell.vue"
import EmptyState from "./EmptyState.vue"
import ChoiceCard from "./kinds/ChoiceCard.vue"
import DefendCard from "./kinds/DefendCard.vue"
import NumberCard from "./kinds/NumberCard.vue"
import TextCard from "./kinds/TextCard.vue"
import SessionEnd from "./SessionEnd.vue"

const SIZE = 5
const KINDS: Record<SessionCard["kind"], Component> = {
  defend: DefendCard,
  choice: ChoiceCard,
  text: TextCard,
  number: NumberCard,
}

const props = defineProps<{ repo?: string }>()
const { t } = useI18n()
const cards = ref<SessionCard[]>([])
const saveFailed = ref(false)
const done = ref(0)
const total = ref(0)
const right = ref(0)
const again = ref(0)
const stillDue = ref<number | null>(null)
const state = ref<"loading" | "ready" | "unpaired" | "error">("loading")
// Answers and flags still on their way: the end screen waits for them, so a failed save can
// put its card back first and "still due" never counts a card that was just answered.
const saving = new Set<Promise<unknown>>()
const current = computed(() => cards.value[0])

// A session is fetched once, with a fixed size: it never grows or reloads on its own.
async function start() {
  state.value = "loading"
  stillDue.value = null
  done.value = right.value = again.value = 0
  try {
    const fetched = await getSession(SIZE + skipped.size, props.repo)
    cards.value = fetched.filter((c) => !skipped.has(c.id)).slice(0, SIZE)
  } catch (error) {
    state.value = error instanceof NotPairedError ? "unpaired" : "error"
    return
  }
  total.value = cards.value.length
  if (total.value === 0) goHome()
  else state.value = "ready"
}

async function finish() {
  while (saving.size > 0) await Promise.allSettled([...saving])
  if (cards.value.length > 0 || state.value !== "ready") return
  let due = 0
  try {
    const summary = await getHome()
    due = props.repo ? (summary.repos.find((r) => r.slug === props.repo)?.due ?? 0) : summary.due
  } catch {
    // The answers are saved; without the summary, the end screen just offers no next session.
  }
  const hidden = [...skipped.values()].filter((slug) => !props.repo || slug === props.repo)
  stillDue.value = Math.max(0, due - hidden.length)
}

function goHome() {
  location.hash = "#/"
}

function advance() {
  cards.value = cards.value.slice(1)
  done.value++
  if (cards.value.length === 0) void finish()
}

async function onDone(given: Answer) {
  const card = current.value
  if (!card) return
  const saved = answer(card.id, given)
  saving.add(saved)
  advance()
  try {
    const { rating } = await saved
    if (rating === "again") again.value++
    else right.value++
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
  if (current.value) skipped.set(current.value.id, current.value.repo)
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

onMounted(start)
</script>

<template>
  <p v-if="saveFailed" class="banner" role="alert" data-test="save-failed">
    {{ t("app.saveFailed") }}
  </p>
  <EmptyState v-if="state !== 'ready'" :variant="state" />
  <CardShell
    v-else-if="current"
    :key="current.id"
    :card="current"
    :position="done + 1"
    :total="total"
    @not-now="onNotNow"
    @flag="onFlag"
  >
    <component :is="KINDS[current.kind]" :card="current" @done="onDone" />
  </CardShell>
  <SessionEnd
    v-else-if="stillDue !== null"
    :reviewed="right + again"
    :right="right"
    :again="again"
    :still-due="stillDue"
    @continue="start"
    @home="goHome"
  />
</template>
