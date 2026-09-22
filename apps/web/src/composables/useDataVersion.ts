import { readonly, ref } from 'vue';

/**
 * Bumped whenever the user's answers change. Kept-alive tabs compare it on
 * activation to decide whether what they show is stale, instead of refetching on
 * every tab switch.
 */
const bookingsVersion = ref(0);

export function useDataVersion() {
  return {
    bookingsVersion: readonly(bookingsVersion),
    markBookingsChanged: () => {
      bookingsVersion.value++;
    },
  };
}
