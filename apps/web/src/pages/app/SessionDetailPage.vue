<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import type { SessionDetailDto } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import ErrorState from '@/components/ErrorState.vue';
import RsvpPanel from '@/components/RsvpPanel.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useResource } from '@/composables/useResource';
import { formatRelativeDay, formatTimeRange } from '@/lib/format';
import { SESSION_TYPE_META } from '@/lib/sessionType';
import { setPageTitle } from '@/router/navigation';
import { getSession } from '@/services/sessions';

const route = useRoute();
const sessionId = computed(() => String(route.params['id'] ?? ''));

const session = useResource(() => getSession(sessionId.value));

onMounted(session.load);
watch(sessionId, session.load);

const meta = computed(() =>
  session.data.value ? SESSION_TYPE_META[session.data.value.type] : null,
);

watch(
  () => meta.value?.label,
  (label) => setPageTitle(label ?? null),
  { immediate: true },
);

/** The panel returns the server's updated session; it decides the outcome. */
function onAnswered(updated: SessionDetailDto): void {
  session.data.value = updated;
}
</script>

<template>
  <div v-if="session.isInitialLoading.value" class="flex flex-col gap-3">
    <SkeletonBlock class="h-36 rounded-2xl" />
    <SkeletonBlock class="h-24 rounded-2xl" />
  </div>

  <ErrorState
    v-else-if="session.error.value"
    :message="session.error.value"
    :retrying="session.isFetching.value"
    @retry="session.load"
  />

  <div v-else-if="session.data.value && meta" class="flex flex-col gap-4">
    <section class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div :class="[meta.accent, 'h-1.5']" />

      <div class="flex flex-col gap-4 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <span
              :class="[
                meta.badge,
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
              ]"
            >
              <AppIcon :name="meta.icon" class="size-4" />
              {{ meta.label }}
            </span>
            <h2 class="text-brand-900 mt-2 text-lg font-semibold">
              {{ session.data.value.title ?? meta.label }}
            </h2>
          </div>
        </div>

        <dl class="flex flex-col gap-2 text-sm">
          <div class="flex items-center gap-2">
            <AppIcon name="clock" class="text-brand-400 size-5" />
            <dt class="sr-only">Quando</dt>
            <dd class="text-brand-700">
              {{ formatRelativeDay(session.data.value.startsAt) }},
              {{ formatTimeRange(session.data.value.startsAt, session.data.value.endsAt) }}
            </dd>
          </div>

          <div class="flex items-center gap-2">
            <AppIcon name="pin" class="text-brand-400 size-5" />
            <dt class="sr-only">Onde</dt>
            <dd>
              <RouterLink
                :to="{ name: 'venue-detail', params: { id: session.data.value.venue.id } }"
                class="text-aula-700 -my-3 inline-flex min-h-11 items-center font-medium"
              >
                {{ session.data.value.venue.name }}
              </RouterLink>
            </dd>
          </div>

          <div v-if="session.data.value.responsible" class="flex items-center gap-2">
            <AppIcon name="user" class="text-brand-400 size-5" />
            <dt class="sr-only">Responsável</dt>
            <dd class="text-brand-700">{{ session.data.value.responsible.name }}</dd>
          </div>

          <div class="flex items-center gap-2">
            <AppIcon name="users" class="text-brand-400 size-5" />
            <dt class="sr-only">Vagas</dt>
            <dd class="text-brand-700">
              {{ session.data.value.confirmedCount }}/{{ session.data.value.capacity }} confirmados
              <span v-if="session.data.value.waitlistCount > 0" class="text-brand-500">
                · {{ session.data.value.waitlistCount }} na lista de espera
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <RsvpPanel :session="session.data.value" @update="onAnswered" />

    <section class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h3 class="text-brand-900 text-sm font-semibold">
        Quem vai
        <span class="text-brand-400 font-normal">({{ session.data.value.attendees.length }})</span>
      </h3>

      <p v-if="session.data.value.attendees.length === 0" class="text-brand-500 text-sm">
        Ninguém confirmou ainda. Seja o primeiro.
      </p>

      <ul v-else class="flex flex-col gap-3">
        <li
          v-for="person in session.data.value.attendees"
          :key="person.id"
          class="flex items-center gap-3"
        >
          <UserAvatar :name="person.name" :src="person.avatarUrl" size="sm" />
          <span class="text-brand-700 truncate text-sm">{{ person.name }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
