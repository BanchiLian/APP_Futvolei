<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import { PERMISSIONS, type VenueWriteInput } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import ErrorState from '@/components/ErrorState.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import VenueForm from '@/components/VenueForm.vue';
import { useCan } from '@/composables/useCan';
import { useResource } from '@/composables/useResource';
import { useToast } from '@/composables/useToast';
import { normalizeApiError } from '@/services/http';
import { getVenue, updateVenue } from '@/services/staff';

/** The CT's own data, as its owner maintains it. */
const route = useRoute();
const toast = useToast();
const { can } = useCan();

const venueId = computed(() => String(route.params['venueId']));
const venue = useResource(() => getVenue(venueId.value));
const isSaving = ref(false);

onMounted(() => void venue.load());

async function save(input: VenueWriteInput): Promise<void> {
  isSaving.value = true;

  try {
    venue.data.value = await updateVenue(venueId.value, input);
    toast.success('CT atualizado.');
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="venue.isInitialLoading.value" class="flex flex-col gap-3">
      <SkeletonBlock v-for="index in 6" :key="index" class="h-12 rounded-xl" />
    </div>

    <ErrorState
      v-else-if="venue.error.value && !venue.data.value"
      :message="venue.error.value"
      :retrying="venue.isFetching.value"
      @retry="venue.load"
    />

    <template v-else-if="venue.data.value">
      <!-- The way into this CT's other screens. Reaching it from the network
           list would otherwise be a dead end for the super admin, who has no
           membership and therefore no shortcuts on the panel. -->
      <nav class="flex gap-2">
        <RouterLink
          v-if="can(PERMISSIONS.SCHEDULE_MANAGE)"
          :to="{ name: 'staff-schedule', params: { venueId } }"
          class="press bg-brand-100 text-brand-800 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        >
          <AppIcon name="calendar" class="size-4" />
          Grade
        </RouterLink>
        <RouterLink
          v-if="can(PERMISSIONS.VENUE_STAFF_MANAGE)"
          :to="{ name: 'staff-team', params: { venueId } }"
          class="press bg-brand-100 text-brand-800 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        >
          <AppIcon name="users" class="size-4" />
          Equipe
        </RouterLink>
      </nav>

      <p
        v-if="venue.data.value.source === 'OSM'"
        class="bg-dayuse-50 text-dayuse-900 rounded-xl p-3 text-sm"
      >
        Os dados deste CT vieram do OpenStreetMap e ainda não foram confirmados. Ao salvar, eles
        passam a ser seus.
      </p>

      <VenueForm
        :venue="venue.data.value"
        :saving="isSaving"
        submit-label="Salvar alterações"
        @submit="save"
      />
    </template>
  </div>
</template>
