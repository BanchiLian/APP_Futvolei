<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import type { IconName } from '@/components/icons';

defineProps<{ icon: IconName; title: string; description?: string }>();
</script>

<template>
  <section class="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-10 text-center">
    <span class="bg-brand-100 text-brand-500 flex size-14 items-center justify-center rounded-full">
      <AppIcon :name="icon" class="size-7" />
    </span>
    <h2 class="text-brand-900 text-base font-semibold">{{ title }}</h2>
    <p v-if="description" class="text-brand-500 max-w-xs text-sm">{{ description }}</p>
    <slot />
  </section>
</template>
