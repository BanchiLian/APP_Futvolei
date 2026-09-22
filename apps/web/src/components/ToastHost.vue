<script setup lang="ts">
import { useToast, type ToastVariant } from '@/composables/useToast';

/** Mounted once, in App.vue. Renders whatever `useToast()` has queued. */
const { toasts, dismiss } = useToast();

const styles: Record<ToastVariant, string> = {
  success: 'bg-success-600 text-white',
  error: 'bg-danger-600 text-white',
  info: 'bg-brand-800 text-white',
};
</script>

<template>
  <!--
    role="status" + aria-live="polite": announced to screen readers without
    interrupting whatever they are reading.
  -->
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-4"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-lg"
        :class="styles[toast.variant]"
      >
        <p class="flex-1 text-sm">{{ toast.message }}</p>

        <button
          type="button"
          class="tap-target -my-2 -mr-2 text-lg leading-none opacity-80"
          aria-label="Fechar aviso"
          @click="dismiss(toast.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
