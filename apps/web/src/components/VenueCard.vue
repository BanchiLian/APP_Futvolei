<script setup lang="ts">
import { RouterLink } from 'vue-router';

import type { VenueSummaryDto } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import SessionTypeBadge from '@/components/SessionTypeBadge.vue';
import { formatDistance, formatRelativeMoment } from '@/lib/format';

defineProps<{ venue: VenueSummaryDto }>();
</script>

<template>
  <RouterLink
    :to="{ name: 'venue-detail', params: { id: venue.id } }"
    class="press flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
  >
    <div class="flex items-start gap-3">
      <span
        class="bg-brand-100 text-brand-700 flex size-11 shrink-0 items-center justify-center rounded-xl"
      >
        <AppIcon name="pin" class="size-6" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-brand-900 truncate text-base font-semibold">{{ venue.name }}</p>
        <p class="text-brand-500 truncate text-sm">
          {{ venue.address }} · {{ venue.city }}/{{ venue.state }}
        </p>
      </div>
      <span
        v-if="venue.distanceKm !== null"
        class="bg-aula-50 text-aula-700 shrink-0 rounded-full px-2 py-1 text-xs font-bold tabular-nums"
      >
        {{ formatDistance(venue.distanceKm) }}
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <SessionTypeBadge v-if="venue.offersAula" type="AULA" />
      <SessionTypeBadge v-if="venue.offersDayuse" type="DAYUSE" />
      <p v-if="venue.nextDayuse" class="text-dayuse-800 ml-auto text-xs font-medium">
        Próximo dayuse {{ formatRelativeMoment(venue.nextDayuse.startsAt) }}
      </p>
    </div>
  </RouterLink>
</template>
