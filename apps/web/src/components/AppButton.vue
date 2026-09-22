<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    type?: 'button' | 'submit';
    variant?: 'primary' | 'secondary' | 'ghost';
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
  }>(),
  { type: 'button', variant: 'primary', loading: false, disabled: false, block: false },
);

// A loading button stays disabled so a double tap cannot submit twice.
const isDisabled = computed(() => props.disabled || props.loading);

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'bg-brand-100 text-brand-800 hover:bg-brand-200';
    case 'ghost':
      return 'bg-transparent text-aula-700 hover:bg-aula-50';
    default:
      return 'bg-aula-600 text-white hover:bg-aula-700';
  }
});
</script>

<template>
  <button
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading ? 'true' : undefined"
    class="tap-target gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    :class="[variantClasses, block ? 'w-full' : '']"
  >
    <span
      v-if="loading"
      class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
