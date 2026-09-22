<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { useField } from 'vee-validate';

/**
 * Text input bound to the surrounding VeeValidate form by `name`.
 *
 * Accessibility is not optional here (section 11): the label is always rendered
 * and tied to the input, and the error is announced through `aria-describedby`
 * plus `aria-invalid` rather than by colour alone.
 */
const props = defineProps<{
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'password' | 'date';
  autocomplete?: string;
  placeholder?: string;
  hint?: string;
}>();

// Field names are fixed at the call site, so a plain string is enough; a getter
// would only tell VeeValidate to watch for a name that never changes.
const { value, errorMessage, handleBlur } = useField<string>(props.name);

const uid = useId();
const inputId = `${uid}-input`;
const errorId = `${uid}-error`;
const hintId = `${uid}-hint`;

const revealed = ref(false);
const isPassword = computed(() => props.type === 'password');

const resolvedType = computed(() => {
  if (!isPassword.value) return props.type ?? 'text';
  return revealed.value ? 'text' : 'password';
});

const describedBy = computed(() => {
  const ids = [props.hint ? hintId : null, errorMessage.value ? errorId : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
});
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="inputId" class="text-brand-700 text-sm font-medium">{{ label }}</label>

    <div class="relative">
      <input
        :id="inputId"
        v-model="value"
        :type="resolvedType"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :aria-invalid="errorMessage ? 'true' : undefined"
        :aria-describedby="describedBy"
        class="text-brand-900 placeholder:text-brand-400 min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base outline-none"
        :class="[
          errorMessage
            ? 'border-danger-500 focus:border-danger-600'
            : 'border-brand-200 focus:border-aula-600',
          isPassword ? 'pr-20' : '',
        ]"
        @blur="handleBlur"
      />

      <button
        v-if="isPassword"
        type="button"
        class="text-brand-500 hover:text-aula-700 absolute inset-y-0 right-0 inline-flex min-w-11 items-center justify-center rounded-r-lg px-3 text-xs font-semibold"
        :aria-label="revealed ? 'Ocultar senha' : 'Mostrar senha'"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        {{ revealed ? 'Ocultar' : 'Mostrar' }}
      </button>
    </div>

    <p v-if="hint" :id="hintId" class="text-brand-400 text-xs">{{ hint }}</p>

    <!-- role="alert" so a screen reader announces the problem as it appears. -->
    <p v-if="errorMessage" :id="errorId" role="alert" class="text-danger-600 text-xs font-medium">
      {{ errorMessage }}
    </p>
  </div>
</template>
