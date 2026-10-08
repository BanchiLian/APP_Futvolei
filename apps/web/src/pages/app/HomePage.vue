<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import {
  BOOKING_STATUSES,
  type BookingStatus,
  type SessionDetailDto,
  type SessionSummaryDto,
  type VenueSummaryDto,
} from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import RsvpPanel from '@/components/RsvpPanel.vue';
import SessionCard from '@/components/SessionCard.vue';
import SessionCardSkeleton from '@/components/SessionCardSkeleton.vue';
import VenueCard from '@/components/VenueCard.vue';
import { useDataVersion } from '@/composables/useDataVersion';
import { useResource } from '@/composables/useResource';
import { firstName, greetingFor } from '@/lib/format';
import { getSession } from '@/services/sessions';
import { listMyBookings } from '@/services/me';
import { listVenues } from '@/services/venues';
import { useAuthStore } from '@/stores/auth';

/** The home tab: what is next for me, then where to play. */
const auth = useAuthStore();
const { bookingsVersion } = useDataVersion();

const mine = useResource(() => listMyBookings('upcoming'));
const venues = useResource(() => listVenues({ onlyDayuse: true }));

/** Full detail of the next session, so the inline answer buttons know the rules. */
const nextDetail = ref<SessionDetailDto | null>(null);

/**
 * "Sua próxima sessão" means one the user is actually going to. A session they
 * declined is still in the upcoming list — it is their answer — but offering it
 * as what comes next would be wrong.
 */
const going = computed(() =>
  (mine.data.value ?? []).filter((session) =>
    (
      [BOOKING_STATUSES.CONFIRMADA, BOOKING_STATUSES.LISTA_ESPERA] as (BookingStatus | null)[]
    ).includes(session.myBookingStatus),
  ),
);

const next = computed<SessionSummaryDto | null>(() => going.value[0] ?? null);
const upcoming = computed(() => going.value.slice(1, 4));
const nearbyDayuse = computed<VenueSummaryDto[]>(() =>
  (venues.data.value ?? []).filter((venue) => venue.nextDayuse !== null).slice(0, 6),
);

async function loadAll(): Promise<void> {
  await Promise.all([mine.load(), venues.load()]);

  const id = next.value?.id;
  nextDetail.value = id ? await getSession(id).catch(() => null) : null;
}

onMounted(loadAll);

let seenVersion = bookingsVersion.value;
onActivated(() => {
  if (seenVersion !== bookingsVersion.value) {
    seenVersion = bookingsVersion.value;
    void loadAll();
  }
});

function onAnswered(updated: SessionDetailDto): void {
  nextDetail.value = updated;
  void mine.load();
}

const greeting = computed(() => `${greetingFor()}, ${firstName(auth.user?.name ?? '')}`);
</script>

<template>
  <PullToRefresh :refresh="loadAll">
    <div class="flex flex-col gap-6">
      <header>
        <h2 class="text-brand-900 text-xl font-semibold">{{ greeting }}</h2>
        <p class="text-brand-500 text-sm">Confirme sua presença e veja quem vai jogar.</p>
      </header>

      <section class="flex flex-col gap-3">
        <h3 class="text-brand-900 px-1 text-sm font-semibold">Sua próxima sessão</h3>

        <SessionCardSkeleton v-if="mine.isInitialLoading.value" />

        <ErrorState
          v-else-if="mine.error.value"
          :message="mine.error.value"
          :retrying="mine.isFetching.value"
          @retry="loadAll"
        />

        <template v-else-if="next">
          <SessionCard :session="next" show-date />
          <RsvpPanel v-if="nextDetail" :session="nextDetail" compact @update="onAnswered" />
        </template>

        <EmptyState
          v-else
          icon="calendar"
          title="Nada marcado ainda"
          description="Escolha um dia na agenda ou um CT para jogar."
        >
          <RouterLink
            :to="{ name: 'agenda' }"
            class="tap-target press bg-aula-600 rounded-xl px-4 text-sm font-semibold text-white"
          >
            Ver agenda
          </RouterLink>
        </EmptyState>
      </section>

      <section v-if="upcoming.length > 0" class="flex flex-col gap-3">
        <h3 class="text-brand-900 px-1 text-sm font-semibold">Depois dessa</h3>
        <SessionCard v-for="session in upcoming" :key="session.id" :session="session" show-date />
      </section>

      <section v-if="nearbyDayuse.length > 0" class="flex flex-col gap-3">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-brand-900 text-sm font-semibold">Dayuse perto de você</h3>
          <RouterLink
            :to="{ name: 'venues' }"
            class="text-aula-700 inline-flex min-h-11 items-center gap-1 px-1 text-xs font-semibold"
          >
            Ver todos
            <AppIcon name="chevron-right" class="size-4" />
          </RouterLink>
        </div>

        <!-- Horizontal, snapping carousel: the native way to browse a shortlist. -->
        <div class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          <div v-for="venue in nearbyDayuse" :key="venue.id" class="w-72 shrink-0 snap-start">
            <VenueCard :venue="venue" />
          </div>
        </div>
      </section>
    </div>
  </PullToRefresh>
</template>
