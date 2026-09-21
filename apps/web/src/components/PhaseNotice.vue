<script setup lang="ts">
/**
 * Placeholder for a screen whose behaviour lands in a later phase.
 * Keeps the navigation walkable without pretending the feature exists.
 */
defineProps<{
  phase: string;
  description: string;
}>();
</script>

<template>
  <section class="border-brand-300 rounded-2xl border border-dashed bg-white p-6 text-center">
    <p class="text-aula-700 text-sm font-semibold tracking-wide uppercase">{{ phase }}</p>
    <p class="text-brand-500 mt-2 text-sm">{{ description }}</p>
  </section>
</template>
