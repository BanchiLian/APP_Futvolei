<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';

import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SessionCard from '@/components/SessionCard.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import { useGeolocation } from '@/composables/useGeolocation';
import { useResource } from '@/composables/useResource';
import { formatDistance } from '@/lib/format';
import { setPageTitle } from '@/router/navigation';
import { getVenue } from '@/services/venues';

const route = useRoute();
const { coords } = useGeolocation();

const venueId = computed(() => String(route.params['id'] ?? ''));

const venue = useResource(() => getVenue(venueId.value, coords.value));

onMounted(venue.load);
watch(venueId, venue.load);

// The header shows the CT's name once it is known, like a native pushed screen.
watch(
  () => venue.data.value?.name,
  (name) => setPageTitle(name ?? null),
  { immediate: true },
);

/** Opens the device's maps app at the CT's coordinates. */
const mapsUrl = computed(() => {
  const data = venue.data.value;
  if (!data) return '#';
  return `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
});
</script>

<template>
  <PullToRefresh :refresh="venue.load">
    <div v-if="venue.isInitialLoading.value" class="flex flex-col gap-3">
      <SkeletonBlock class="h-32 rounded-2xl" />
      <SkeletonBlock class="h-24 rounded-2xl" />
    </div>

    <ErrorState
      v-else-if="venue.error.value"
      :message="venue.error.value"
      :retrying="venue.isFetching.value"
      @retry="venue.load"
    />

    <div v-else-if="venue.data.value" class="flex flex-col gap-5">
      <section class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div class="flex items-start gap-3">
          <span
            class="bg-brand-100 text-brand-700 flex size-12 shrink-0 items-center justify-center rounded-xl"
          >
            <AppIcon name="pin" class="size-6" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-brand-900 text-lg font-semibold">{{ venue.data.value.name }}</h2>
            <p class="text-brand-500 text-sm">
              {{ venue.data.value.address }} · {{ venue.data.value.city }}/{{
                venue.data.value.state
              }}
            </p>
            <p v-if="venue.data.value.distanceKm !== null" class="text-brand-400 mt-1 text-xs">
              a {{ formatDistance(venue.data.value.distanceKm) }} de você
            </p>
          </div>
        </div>

        <p v-if="venue.data.value.description" class="text-brand-600 text-sm">
          {{ venue.data.value.description }}
        </p>

        <div class="flex flex-wrap gap-2">
          <span
            v-if="venue.data.value.offersAula"
            class="bg-aula-100 text-aula-700 rounded-full px-2.5 py-1 text-xs font-semibold"
          >
            Aulas
          </span>
          <span
            v-if="venue.data.value.offersDayuse"
            class="bg-dayuse-100 text-dayuse-700 rounded-full px-2.5 py-1 text-xs font-semibold"
          >
            Dayuse
          </span>
        </div>

        <div class="flex flex-wrap gap-2">
          <a
            :href="mapsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="tap-target press bg-brand-100 text-brand-800 gap-2 rounded-xl px-4 text-sm font-semibold"
          >
            <AppIcon name="route" class="size-5" />
            Como chegar
          </a>
          <a
            v-if="venue.data.value.instagram"
            :href="`https://instagram.com/${venue.data.value.instagram}`"
            target="_blank"
            rel="noopener noreferrer"
            class="tap-target press bg-brand-100 text-brand-800 gap-2 rounded-xl px-4 text-sm font-semibold"
          >
            <AppIcon name="link" class="size-5" />
            Instagram
          </a>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h3 class="text-brand-900 px-1 text-sm font-semibold">Próximas sessões</h3>

        <EmptyState
          v-if="venue.data.value.upcomingSessions.length === 0"
          icon="calendar"
          title="Nada marcado por aqui"
          description="Este CT ainda não tem sessões nas próximas semanas."
        />

        <SessionCard
          v-for="session in venue.data.value.upcomingSessions"
          :key="session.id"
          :session="session"
          show-date
          :show-venue="false"
        />
      </section>
    </div>
  </PullToRefresh>
</template>
