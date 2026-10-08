<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import {
  PERMISSIONS,
  SESSION_STATUSES,
  VENUE_ROLE_LABELS,
  type SessionSummaryDto,
} from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import SessionCardSkeleton from '@/components/SessionCardSkeleton.vue';
import SessionTypeBadge from '@/components/SessionTypeBadge.vue';
import { useCan } from '@/composables/useCan';
import { useResource } from '@/composables/useResource';
import { formatRelativeDay, formatTimeRange } from '@/lib/format';
import { getOverview } from '@/services/staff';

/**
 * The panel, for all three kinds of staff.
 *
 * Whoever teaches sees the sessions they answer for. Whoever runs a CT sees the
 * whole day there, including sessions another professor conducts — that
 * difference is decided by the server, so the screen cannot show more than the
 * person is allowed to act on.
 */
const { can } = useCan();

const RANGES = [
  { value: '1', label: 'Hoje' },
  { value: '7', label: 'Semana' },
];

const range = ref('1');
const venueId = ref<string | undefined>(undefined);

const overview = useResource(() => getOverview(Number(range.value), venueId.value));

onMounted(() => void overview.load());
watch([range, venueId], () => void overview.load());

const venues = computed(() => overview.data.value?.venues ?? []);
const sessions = computed<SessionSummaryDto[]>(() => overview.data.value?.sessions ?? []);

/** The CT whose management screens the shortcuts point at. */
const currentVenue = computed(
  () => venues.value.find((venue) => venue.id === venueId.value) ?? venues.value[0] ?? null,
);

const venueOptions = computed(() => [
  { value: '', label: 'Todos' },
  ...venues.value.map((venue) => ({ value: venue.id, label: venue.name })),
]);

const venuePicker = computed({
  get: () => venueId.value ?? '',
  set: (value: string) => {
    venueId.value = value === '' ? undefined : value;
  },
});

/**
 * Says plainly which hat the person is wearing and where.
 *
 * Added because the panel looks identical to an owner and to a professor until
 * you notice which shortcuts are missing, and that is not something anyone
 * should have to notice.
 */
const standing = computed(() => {
  const venue = currentVenue.value;

  if (can(PERMISSIONS.ADMIN_MANAGE) && !venue) return 'Você administra a rede inteira.';
  if (!venue) return null;

  const role = venue.myRole
    ? VENUE_ROLE_LABELS[venue.myRole]
    : can(PERMISSIONS.ADMIN_MANAGE)
      ? 'Administração da rede'
      : null;

  return role ? `${role} · ${venue.name}` : venue.name;
});

const totals = computed(() => ({
  sessions: sessions.value.length,
  people: sessions.value.reduce((sum, session) => sum + session.confirmedCount, 0),
}));

/** Management shortcuts, each hidden unless the person can actually use it. */
const shortcuts = computed(() => {
  const venue = currentVenue.value;
  const items: Array<{
    to: object;
    icon: 'pin' | 'calendar' | 'users' | 'aula' | 'list' | 'lock';
    label: string;
  }> = [];

  // First, because it is what both an owner and a professor open the panel for:
  // who plays here. A professor has this and nothing else below it.
  if (venue && can(PERMISSIONS.VENUE_PEOPLE_VIEW)) {
    items.push({
      to: { name: 'staff-people', params: { venueId: venue.id } },
      icon: 'users',
      label: 'Alunos',
    });
  }

  if (venue && can(PERMISSIONS.VENUE_MANAGE)) {
    items.push({
      to: { name: 'staff-venue', params: { venueId: venue.id } },
      icon: 'pin',
      label: 'Meu CT',
    });
  }

  if (venue && can(PERMISSIONS.SCHEDULE_MANAGE)) {
    items.push({
      to: { name: 'staff-schedule', params: { venueId: venue.id } },
      icon: 'calendar',
      label: 'Grade',
    });
  }

  if (venue && can(PERMISSIONS.VENUE_STAFF_MANAGE)) {
    items.push({
      to: { name: 'staff-team', params: { venueId: venue.id } },
      icon: 'aula',
      label: 'Equipe',
    });
  }

  if (can(PERMISSIONS.ADMIN_MANAGE)) {
    items.push({ to: { name: 'staff-network' }, icon: 'list', label: 'Rede' });
  }

  if (can(PERMISSIONS.AUDIT_VIEW)) {
    items.push({ to: { name: 'staff-audit' }, icon: 'lock', label: 'Auditoria' });
  }

  return items;
});

function isCancelled(session: SessionSummaryDto): boolean {
  return session.status === SESSION_STATUSES.CANCELADA;
}
</script>

<template>
  <PullToRefresh :refresh="overview.load">
    <div class="flex flex-col gap-4">
      <!-- Only worth showing to someone who runs more than one CT. -->
      <SegmentedControl
        v-if="venues.length > 1"
        v-model="venuePicker"
        :options="venueOptions"
        label="CT"
      />

      <p v-if="standing" class="text-brand-500 px-1 text-sm">{{ standing }}</p>

      <nav v-if="shortcuts.length > 0" class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <RouterLink
          v-for="shortcut in shortcuts"
          :key="shortcut.label"
          :to="shortcut.to"
          class="press bg-brand-100 text-brand-800 flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
        >
          <AppIcon :name="shortcut.icon" class="size-4" />
          {{ shortcut.label }}
        </RouterLink>
      </nav>

      <SegmentedControl v-model="range" :options="RANGES" label="Período" />

      <div v-if="overview.isInitialLoading.value" class="flex flex-col gap-3">
        <SessionCardSkeleton v-for="index in 3" :key="index" />
      </div>

      <ErrorState
        v-else-if="overview.error.value && sessions.length === 0"
        :message="overview.error.value"
        :retrying="overview.isFetching.value"
        @retry="overview.load"
      />

      <EmptyState
        v-else-if="sessions.length === 0"
        icon="calendar"
        title="Nada por aqui"
        :description="
          range === '1' ? 'Nenhuma sessão hoje.' : 'Nenhuma sessão nos próximos sete dias.'
        "
      />

      <template v-else>
        <p class="text-brand-500 px-1 text-xs">
          {{ totals.sessions }} {{ totals.sessions === 1 ? 'sessão' : 'sessões' }} ·
          {{ totals.people }} {{ totals.people === 1 ? 'confirmado' : 'confirmados' }}
        </p>

        <ul class="flex flex-col gap-3">
          <li v-for="session in sessions" :key="session.id">
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
                  <p v-if="session.responsible" class="text-brand-500 truncate text-xs">
                    com {{ session.responsible.name }}
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
