<script setup lang="ts" generic="T extends string">
defineProps<{ options: readonly { value: T; label: string }[]; label: string }>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="bg-brand-100 flex rounded-xl p-1" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="press min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors"
      :class="model === option.value ? 'text-brand-900 bg-white shadow-sm' : 'text-brand-500'"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
