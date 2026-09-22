import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

/** A copy of `source` that only follows it after `delayMs` of quiet — for search boxes. */
export function useDebouncedRef<T>(source: Ref<T>, delayMs = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(source, (value) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      debounced.value = value;
    }, delayMs);
  });

  onBeforeUnmount(() => clearTimeout(timer));

  return debounced;
}
