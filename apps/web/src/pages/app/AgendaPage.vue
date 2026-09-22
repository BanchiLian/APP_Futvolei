<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';

import { SESSION_TYPES, addDays, businessDateKey, type SessionType } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import SessionCard from '@/components/SessionCard.vue';
import SessionCardSkeleton from '@/components/SessionCardSkeleton.vue';
import { useDataVersion } from '@/composables/useDataVersion';
import { useResource } from '@/composables/useResource';
import { formatWeekRange, noonOf, weekKeysContaining } from '@/lib/format';
import { SESSION_TYPE_META } from '@/lib/sessionType';
import { listSessions } from '@/services/sessions';
import { useAuthStore } from '@/stores/auth';

/**
 * The week's agenda: a week stepper, a day strip, and the sessions of the day
 * the user picked.
 */
const auth = useAuthStore();
const { bookingsVersion } = useDataVersion();

const weekOffset = ref(0);
const selectedKey = ref(businessDateKey(new Date()));

const weekKeys = computed(() => weekKeysContaining(addDays(new Date(), weekOffset.value * 7)));

type TypeFilter = SessionType | 'ALL';

// Someone who only sees one kind of session has no use for a filter.
const visibleTypes = computed<SessionType[]>(() => {
  const types: SessionType[] = [];
  if (auth.can('session:view:aula')) types.push(SESSION_TYPES.AULA);
  if (auth.can('session:view:dayuse')) types.push(SESSION_TYPES.DAYUSE);
  return types;
});

const typeFilter = ref<TypeFilter>('ALL');
const typeOptions = computed(() => [
  { value: 'ALL' as const, label: 'Tudo' },
  ...visibleTypes.value.map((type) => ({ value: type, label: SESSION_TYPE_META[type].label })),
]);

const sessions = useResource(() => {
  const first = weekKeys.value[0] ?? businessDateKey(new Date());
  const last = weekKeys.value[weekKeys.value.length - 1] ?? first;

  return listSessions({
    from: noonOf(first),
    to: addDays(noonOf(last), 1),
    ...(typeFilter.value === 'ALL' ? {} : { type: typeFilter.value }),
  });
});

onMounted(sessions.load);
watch([weekKeys, typeFilter], sessions.load);

// Coming back to the tab after answering elsewhere should not show stale counts.
let seenVersion = bookingsVersion.value;
onActivated(() => {
  if (seenVersion !== bookingsVersion.value) {
    seenVersion = bookingsVersion.value;
    void sessions.load();
  }
});

const byDay = computed(() => {
  const map = new Map<string, number>();
  for (const session of sessions.data.value ?? []) {
    const key = businessDateKey(session.startsAt);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
});

const daySessions = computed(() =>
  (sessions.data.value ?? []).filter(
    (session) => businessDateKey(session.startsAt) === selectedKey.value,
  ),
);

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function dayLabel(key: string): { weekday: string; day: string } {
  const noon = noonOf(key);
  return {
    weekday: WEEKDAY_SHORT[noon.getDay()] ?? '',
    day: key.slice(8),
  };
}

const todayKey = businessDateKey(new Date());

function goToWeek(offset: number): void {
  weekOffset.value = offset;
  // Keep a sensible selection: this week opens on today, others on their Monday.
  const keys = weekKeysContaining(addDays(new Date(), offset * 7));
  selectedKey.value = offset === 0 ? todayKey : (keys[0] ?? todayKey);
}
</script>

<template>
  <PullToRefresh :refresh="sessions.load">
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          class="tap-target press text-brand-600 rounded-xl"
          aria-label="Semana anterior"
          @click="goToWeek(weekOffset - 1)"
        >
          <AppIcon name="chevron-left" class="size-5" />
        </button>

        <p class="text-brand-900 text-sm font-semibold">{{ formatWeekRange(weekKeys) }}</p>

        <button
          type="button"
          class="tap-target press text-brand-600 rounded-xl"
          aria-label="Próxima semana"
          @click="goToWeek(weekOffset + 1)"
        >
          <AppIcon name="chevron-right" class="size-5" />
        </button>
      </div>

      <!-- Day strip: horizontal, snapping, like a native date picker. -->
      <div class="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
        <button
          v-for="key in weekKeys"
          :key="key"
          type="button"
          class="press flex min-w-14 shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl px-2 py-2"
          :class="
            key === selectedKey
              ? 'bg-aula-600 text-white'
              : 'text-brand-600 bg-white ring-1 ring-black/5'
          "
          :aria-pressed="key === selectedKey"
          @click="selectedKey = key"
        >
          <span class="text-[11px] uppercase">{{ dayLabel(key).weekday }}</span>
          <span class="text-base font-semibold">{{ dayLabel(key).day }}</span>
          <span
            class="size-1.5 rounded-full"
            :class="
              byDay.get(key) ? (key === selectedKey ? 'bg-white' : 'bg-aula-500') : 'bg-transparent'
            "
          />
        </button>
      </div>

      <SegmentedControl
        v-if="typeOptions.length > 2"
        v-model="typeFilter"
        :options="typeOptions"
        label="Filtrar por tipo de sessão"
      />

      <div v-if="sessions.isInitialLoading.value" class="flex flex-col gap-3">
        <SessionCardSkeleton v-for="index in 3" :key="index" />
      </div>

      <ErrorState
        v-else-if="sessions.error.value"
        :message="sessions.error.value"
        :retrying="sessions.isFetching.value"
        @retry="sessions.load"
      />

      <EmptyState
        v-else-if="daySessions.length === 0"
        icon="calendar"
        title="Nada neste dia"
        description="Escolha outro dia ou outra semana para ver as sessões."
      />

      <div v-else class="flex flex-col gap-3">
        <SessionCard v-for="session in daySessions" :key="session.id" :session="session" />
      </div>
    </div>
  </PullToRefresh>
</template>
