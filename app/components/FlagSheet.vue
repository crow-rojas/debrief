<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import type { FlagInput } from "../api.ts"

const emit = defineEmits<{ submit: [input: FlagInput]; cancel: [] }>()
const { t } = useI18n()
const note = ref("")
const submit = (action: FlagInput["action"]) =>
  emit("submit", note.value.trim() ? { note: note.value.trim(), action } : { action })
</script>

<template>
  <section class="sheet" :aria-label="t('app.flag.title')">
    <h2>{{ t("app.flag.title") }}</h2>
    <label class="field">
      <span>{{ t("app.flag.note") }}</span>
      <textarea v-model="note" rows="3" data-test="flag-note" />
    </label>
    <div class="row">
      <button type="button" class="secondary" data-test="flag-discard" @click="submit('discard')">
        {{ t("app.flag.discard") }}
      </button>
      <button
        type="button"
        class="primary"
        data-test="flag-regenerate"
        @click="submit('regenerate')"
      >
        {{ t("app.flag.regenerate") }}
      </button>
    </div>
    <button type="button" class="link" @click="emit('cancel')">{{ t("app.flag.cancel") }}</button>
  </section>
</template>
