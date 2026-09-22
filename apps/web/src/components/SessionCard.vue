<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { SESSION_STATUSES, type SessionSummaryDto } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import SessionTypeBadge from '@/components/SessionTypeBadge.vue';
import { formatRelativeDay, formatTimeRange } from '@/lib/format';
import { answerFromStatus } from '@/lib/rsvpState';
import { SESSION_TYPE_META } from '@/lib/sessionType';

const props = withDefaults(
  defineProps<{ session: SessionSummaryDto; showDate?: boolean; showVenue?: boolean }>(),
  { showDate: false, showVenue: true },
);

const meta = computed(() => SESSION_TYPE_META[props.session.type]);
const isCancelled = computed(() => props.session.status === SESSION_STATUSES.CANCELADA);
const isFull = computed(() => props.session.availableSeats <= 0);

const myStatus = computed(() => {
  if (isCancelled.value) return { label: 'Cancelada', tone: 'bg-danger-50 text-danger-700' };
  switch (answerFromStatus(props.session.myBookingStatus)) {
    case 'going':
      return { label: 'Você vai', tone: 'bg-success-50 text-success-700' };
    case 'waitlist':
      return {
        label: props.session.myWaitlistPosition
          ? `Espera · ${props.session.myWaitlistPosition}º`
          : 'Lista de espera',
        tone: 'bg-dayuse-100 text-dayuse-800',
      };
    case 'not-going':
      return { label: 'Não vou', tone: 'bg-brand-100 text-brand-600' };
    case 'attended':
      return { label: 'Presente', tone: 'bg-success-50 text-success-700' };
    case 'missed':
      return { label: 'Faltou', tone: 'bg-danger-50 text-danger-700' };
    default:
      return null;
  }
});

const heading = computed(() => props.session.title ?? meta.value.label);

const accessibleLabel = computed(() =>
  [
    meta.value.label,
    heading.value !== meta.value.label ? heading.value : null,
    props.showDate ? formatRelativeDay(props.session.startsAt) : null,
    formatTimeRange(props.session.startsAt, props.session.endsAt).replace('–', 'até'),
    props.session.venue.name,
    `${props.session.confirmedCount} de ${props.session.capacity} vagas ocupadas`,
    myStatus.value?.label,
  ]
    .filter(Boolean)
    .join(', '),
);
</script>

<template>
  <RouterLink
    :to="{ name: 'session-detail', params: { id: session.id } }"
    class="press relative flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
    :class="isCancelled ? 'opacity-75' : ''"
    :aria-label="accessibleLabel"
  >
    <span class="w-1.5 shrink-0" :class="meta.accent" aria-hidden="true" />

    <div class="flex min-w-0 flex-1 flex-col gap-2 p-4">
      <div class="flex items-center gap-2">
        <SessionTypeBadge :type="session.type" />
        <span v-if="showDate" class="text-brand-500 text-xs font-medium">
          {{ formatRelativeDay(session.startsAt) }}
        </span>
        <span
          v-if="myStatus"
          class="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold"
          :class="myStatus.tone"
        >
          {{ myStatus.label }}
        </span>
      </div>

      <div class="flex items-end justify-between gap-3">
        <div class="min-w-0">
          <p
            class="text-brand-900 text-lg leading-tight font-bold tabular-nums"
            :class="isCancelled ? 'line-through' : ''"
          >
            {{ formatTimeRange(session.startsAt, session.endsAt) }}
          </p>
          <p class="text-brand-600 mt-1 truncate text-sm">
            <template v-if="heading !== meta.label">{{ heading }} · </template>
            <template v-if="showVenue">{{ session.venue.name }}</template>
          </p>
          <p v-if="session.responsible" class="text-brand-500 mt-0.5 truncate text-xs">
            com {{ session.responsible.name }}
          </p>
        </div>

        <span
          class="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold tabular-nums"
          :class="isFull ? 'bg-danger-50 text-danger-700' : 'bg-brand-100 text-brand-700'"
          aria-hidden="true"
        >
          <AppIcon name="users" class="size-3.5" :stroke-width="2.2" />
          {{ isFull ? 'Lotado' : `${session.confirmedCount}/${session.capacity}` }}
        </span>
      </div>
    </div>

    <AppIcon name="chevron-right" class="text-brand-300 mr-2 size-5 self-center" />
  </RouterLink>
</template>
