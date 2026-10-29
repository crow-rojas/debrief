<script setup lang="ts">
import { useI18n } from "vue-i18n"

defineProps<{ variant: "unpaired" | "error" | "loading" }>()
const { t } = useI18n()
</script>

<template>
  <section class="empty" aria-live="polite">
    <p v-if="variant === 'loading'">{{ t("app.loading") }}</p>
    <p v-else-if="variant === 'error'">{{ t("app.error") }}</p>
    <template v-else>
      <h1>{{ t("app.unpaired.title") }}</h1>
      <p>{{ t("app.unpaired.body") }}</p>
    </template>
  </section>
</template>
