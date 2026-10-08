<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import { SESSION_STATUSES, type SessionSummaryDto } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import SessionCardSkeleton from '@/components/SessionCardSkeleton.vue';
import SessionTypeBadge from '@/components/SessionTypeBadge.vue';
import { useResource } from '@/composables/useResource';
import { formatRelativeDay, formatTimeRange } from '@/lib/format';
import { listMySessions } from '@/services/attendance';

/**
 * What whoever is teaching needs on the sand: the sessions they answer for, and
 * one tap to the checklist of each.
 *
 * Opens on today because that is the question being asked at the court; the
 * week is one tap away for planning.
 */
const RANGES = [
  { value: '1', label: 'Hoje' },
  { value: '7', label: 'Semana' },
];

const range = ref('1');

const sessions = useResource(() => listMySessions(Number(range.value)));

onMounted(() => void sessions.load());
watch(range, () => void sessions.load());

const list = computed<SessionSummaryDto[]>(() => sessions.data.value ?? []);

/** Counts for the header, so the day can be read without opening anything. */
const totals = computed(() => ({
  sessions: list.value.length,
  people: list.value.reduce((sum, session) => sum + session.confirmedCount, 0),
}));

function isCancelled(session: SessionSummaryDto): boolean {
  return session.status === SESSION_STATUSES.CANCELADA;
}
</script>

<template>
  <PullToRefresh :refresh="sessions.load">
    <div class="flex flex-col gap-4">
      <SegmentedControl v-model="range" :options="RANGES" label="Período" />

      <div v-if="sessions.isInitialLoading.value" class="flex flex-col gap-3">
        <SessionCardSkeleton v-for="index in 3" :key="index" />
      </div>

      <ErrorState
        v-else-if="sessions.error.value && list.length === 0"
        :message="sessions.error.value"
        :retrying="sessions.isFetching.value"
        @retry="sessions.load"
      />

      <EmptyState
        v-else-if="list.length === 0"
        icon="calendar"
        title="Nenhuma sessão sua"
        :description="
          range === '1'
            ? 'Você não é o responsável por nenhuma sessão hoje.'
            : 'Você não é o responsável por nenhuma sessão nesta semana.'
        "
      />

      <template v-else>
        <p class="text-brand-500 px-1 text-xs">
          {{ totals.sessions }} {{ totals.sessions === 1 ? 'sessão' : 'sessões' }} ·
          {{ totals.people }} {{ totals.people === 1 ? 'confirmado' : 'confirmados' }}
        </p>

        <ul class="flex flex-col gap-3">
          <li v-for="session in list" :key="session.id">
            <RouterLink
              :to="{ name: 'attendance-sheet', params: { id: session.id } }"
              class="press focus-visible:outline-aula-600 block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 focus-visible:outline-2"
            >
              <div class="flex items-start gap-3">
                <div class="min-w-0 flex-1">
                  <div class="mb-1 flex items-center gap-2">
                    <SessionTypeBadge :type="session.type" />
                    <span
                      v-if="isCancelled(session)"
                      class="bg-danger-50 text-danger-700 rounded-full px-2 py-0.5 text-xs font-medium"
                    >
                      Cancelada
                    </span>
                  </div>

                  <p class="text-brand-900 text-lg font-semibold">
                    {{ formatTimeRange(session.startsAt, session.endsAt) }}
                  </p>
                  <p class="text-brand-600 truncate text-sm">
                    {{ formatRelativeDay(session.startsAt) }} · {{ session.venue.name }}
                  </p>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <span
                    class="bg-brand-100 text-brand-700 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold"
                  >
                    <AppIcon name="users" class="size-3.5" :stroke-width="2.2" />
                    {{ session.confirmedCount }}/{{ session.capacity }}
                  </span>
                  <AppIcon name="chevron-right" class="text-brand-400 size-5" />
                </div>
              </div>
            </RouterLink>
          </li>
        </ul>
      </template>
    </div>
  </PullToRefresh>
</template>
