import { readonly, ref } from 'vue';

/**
 * Toast feedback for actions (section 10).
 *
 * The queue lives at module scope, so any component can raise a toast and a
 * single `ToastHost` renders them all.
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

const DEFAULT_DURATION_MS = 5_000;

const toasts = ref<Toast[]>([]);
let nextId = 0;

function push(message: string, variant: ToastVariant, durationMs: number): void {
  const id = nextId++;
  toasts.value.push({ id, message, variant });

  window.setTimeout(() => dismiss(id), durationMs);
}

function dismiss(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

export function useToast() {
  return {
    toasts: readonly(toasts),
    dismiss,
    success: (message: string, durationMs = DEFAULT_DURATION_MS) =>
      push(message, 'success', durationMs),
    // Errors linger, because they usually ask the user to do something.
    error: (message: string, durationMs = 8_000) => push(message, 'error', durationMs),
    info: (message: string, durationMs = DEFAULT_DURATION_MS) => push(message, 'info', durationMs),
  };
}
