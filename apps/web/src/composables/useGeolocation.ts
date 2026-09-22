import { readonly, ref } from 'vue';

import type { Coordinates } from '@/services/venues';

export type GeolocationStatus =
  'idle' | 'locating' | 'granted' | 'denied' | 'unavailable' | 'unsupported';

/**
 * The user's position, asked for only on an explicit tap.
 *
 * Module scope so the CT list, the CT detail and the home carousel share one
 * answer instead of each prompting. Kept in memory only: it is never persisted
 * or sent anywhere except as query parameters for sorting.
 */
const coords = ref<Coordinates | null>(null);
const status = ref<GeolocationStatus>('idle');

function isSupported(): boolean {
  // Browsers only expose geolocation on HTTPS (or localhost).
  return typeof navigator !== 'undefined' && 'geolocation' in navigator && window.isSecureContext;
}

function request(): Promise<Coordinates | null> {
  if (!isSupported()) {
    status.value = 'unsupported';
    return Promise.resolve(null);
  }

  status.value = 'locating';

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        coords.value = { lat: position.coords.latitude, lng: position.coords.longitude };
        status.value = 'granted';
        resolve(coords.value);
      },
      (failure) => {
        status.value = failure.code === failure.PERMISSION_DENIED ? 'denied' : 'unavailable';
        resolve(null);
      },
      // A city-block precision is plenty to sort CTs, and it comes back faster.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  });
}

export function useGeolocation() {
  return {
    coords: readonly(coords),
    status: readonly(status),
    isSupported,
    request,
  };
}
