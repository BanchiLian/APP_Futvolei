import { computed, ref, shallowRef, type Ref } from 'vue';

import { normalizeApiError } from '@/services/http';

/**
 * Loading/error/data state for one screen's request, with the distinctions a
 * native-feeling screen needs: the first load shows a skeleton, a refresh keeps
 * the current content on screen, and a slow stale response never overwrites a
 * newer one.
 */
export function useResource<T>(fetcher: () => Promise<T>) {
  const data = shallowRef<T | null>(null) as Ref<T | null>;
  const error = ref<string | null>(null);
  const isFetching = ref(false);
  const loadedAt = ref<number | null>(null);
  let requestId = 0;

  /** Skeleton only when there is nothing to show yet. */
  const isInitialLoading = computed(() => isFetching.value && data.value === null);

  async function load(): Promise<void> {
    const id = ++requestId;
    isFetching.value = true;
    error.value = null;

    try {
      const result = await fetcher();
      if (id !== requestId) return;
      data.value = result;
      loadedAt.value = Date.now();
    } catch (caught) {
      if (id !== requestId) return;
      error.value = normalizeApiError(caught).message;
    } finally {
      if (id === requestId) isFetching.value = false;
    }
  }

  return { data, error, isFetching, isInitialLoading, loadedAt, load };
}
