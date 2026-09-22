<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { initialsOf } from '@/lib/format';

const props = withDefaults(
  defineProps<{ name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }>(),
  { src: null, size: 'md' },
);

// A broken photo URL falls back to initials instead of a broken-image icon.
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

const sizeClass = computed(
  () =>
    ({
      sm: 'size-8 text-xs',
      md: 'size-11 text-sm',
      lg: 'size-14 text-base',
      xl: 'size-20 text-2xl',
    })[props.size],
);

// A stable hue per person makes a list of initials easier to scan.
const palette = [
  'bg-aula-100 text-aula-700',
  'bg-dayuse-100 text-dayuse-800',
  'bg-success-100 text-success-700',
  'bg-brand-200 text-brand-700',
] as const;

const tone = computed(() => {
  let hash = 0;
  for (const char of props.name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
});
</script>

<template>
  <img
    v-if="src && !failed"
    :src="src"
    alt=""
    class="shrink-0 rounded-full object-cover"
    :class="sizeClass"
    loading="lazy"
    decoding="async"
    @error="failed = true"
  />
  <span
    v-else
    class="flex shrink-0 items-center justify-center rounded-full font-semibold"
    :class="[sizeClass, tone]"
    aria-hidden="true"
  >
    {{ initialsOf(name) }}
  </span>
</template>
