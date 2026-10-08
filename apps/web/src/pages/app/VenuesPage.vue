<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import VenueCard from '@/components/VenueCard.vue';
import { useGeolocation } from '@/composables/useGeolocation';
import { useResource } from '@/composables/useResource';
import { listVenues } from '@/services/venues';

/**
 * Training centres, nearest first.
 *
 * Location is never taken silently: the user taps "Usar minha localização" and
 * the browser asks. Without it the list still works, just alphabetically — a
 * denied permission must not leave an empty screen.
 */
const { coords, status: geoStatus, isSupported, request } = useGeolocation();

const onlyDayuse = ref(false);

const venues = useResource(() =>
  listVenues({ coords: coords.value, onlyDayuse: onlyDayuse.value }),
);

onMounted(venues.load);
watch([coords, onlyDayuse], venues.load);

const isLocating = computed(() => geoStatus.value === 'locating');
const hasLocation = computed(() => coords.value !== null);

const locationHint = computed(() => {
  switch (geoStatus.value) {
    case 'denied':
      return 'Você não permitiu o acesso à localização. A lista está em ordem alfabética.';
    case 'unavailable':
      return 'Não foi possível obter sua localização agora. A lista está em ordem alfabética.';
    case 'unsupported':
      // Browsers only expose geolocation over HTTPS or on localhost.
      return 'Este navegador não fornece localização nesta conexão. A lista está em ordem alfabética.';
    default:
      return null;
  }
});
</script>

<template>
  <PullToRefresh :refresh="venues.load">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3">
        <AppButton
          v-if="!hasLocation && isSupported()"
          variant="secondary"
          block
          :loading="isLocating"
          @click="request"
        >
          <AppIcon name="locate" class="size-5" />
          Usar minha localização
        </AppButton>

        <p v-if="hasLocation" class="text-brand-500 flex items-center gap-1.5 text-xs">
          <AppIcon name="locate" class="text-success-600 size-4" />
          Ordenado pela distância até você.
        </p>

        <p v-else-if="locationHint" class="text-brand-500 text-xs">{{ locationHint }}</p>

        <label class="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            v-model="onlyDayuse"
            type="checkbox"
            class="accent-aula-600 size-5 cursor-pointer"
          />
          <span class="text-brand-700 text-sm font-medium">Só CTs com Dayuse</span>
        </label>
      </div>

      <div v-if="venues.isInitialLoading.value" class="flex flex-col gap-3">
        <SkeletonBlock v-for="index in 4" :key="index" class="h-28 rounded-2xl" />
      </div>

      <ErrorState
        v-else-if="venues.error.value"
        :message="venues.error.value"
        :retrying="venues.isFetching.value"
        @retry="venues.load"
      />

      <EmptyState
        v-else-if="(venues.data.value ?? []).length === 0"
        icon="pin"
        title="Nenhum CT por aqui"
        :description="
          onlyDayuse
            ? 'Nenhum CT com Dayuse cadastrado. Tente sem o filtro.'
            : 'Ainda não há CTs cadastrados.'
        "
      />

      <div v-else class="flex flex-col gap-3">
        <VenueCard v-for="venue in venues.data.value ?? []" :key="venue.id" :venue="venue" />

        <!-- Part of the list comes from OpenStreetMap, whose ODbL licence requires
             the credit to be visible wherever the data is shown. -->
        <p class="text-brand-400 px-2 pt-2 text-center text-xs">
          Parte dos CTs vem do
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            class="underline underline-offset-2"
            >OpenStreetMap</a
          >
          e ainda não foi confirmada pelo CT.
        </p>
      </div>
    </div>
  </PullToRefresh>
</template>
