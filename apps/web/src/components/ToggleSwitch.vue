<script setup lang="ts">
import { useId } from 'vue';

defineProps<{ label: string; description?: string; disabled?: boolean }>();
const model = defineModel<boolean>({ required: true });

const uid = useId();
</script>

<template>
  <div class="flex min-h-11 items-center gap-4">
    <div class="min-w-0 flex-1">
      <p :id="`${uid}-label`" class="text-brand-900 text-sm font-medium">{{ label }}</p>
      <p v-if="description" :id="`${uid}-desc`" class="text-brand-500 mt-0.5 text-xs">
        {{ description }}
      </p>
    </div>
    <button
      type="button"
      role="switch"
      :aria-checked="model"
      :aria-labelledby="`${uid}-label`"
      :aria-describedby="description ? `${uid}-desc` : undefined"
      :disabled="disabled"
      class="press relative flex h-11 w-13 shrink-0 items-center justify-center disabled:opacity-60"
      @click="model = !model"
    >
      <!--
        The button is a 44px tap target; the switch drawn inside it is smaller,
        so the control looks right without being hard to hit.
      -->
      <span
        class="flex h-7 w-12 items-center rounded-full transition-colors motion-reduce:transition-none"
        :class="model ? 'bg-success-600' : 'bg-brand-300'"
      >
        <span
          class="size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none"
          :class="model ? 'translate-x-6' : 'translate-x-1'"
        />
      </span>
    </button>
  </div>
</template>
