<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { VENUE_ROLE_LABELS, type VenuePersonDto } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useDebouncedRef } from '@/composables/useDebouncedRef';
import { useResource } from '@/composables/useResource';
import { formatRelativeMoment } from '@/lib/format';
import { SKILL_LEVEL_LABELS } from '@/lib/skillLevel';
import { listVenuePeople } from '@/services/staff';
import { useRoute } from 'vue-router';

/**
 * The people of this CT.
 *
 * Who appears is decided by the server: whoever runs the CT sees the players and
 * the staff, whoever teaches sees the players only. The screen renders whatever
 * comes back rather than deciding for itself, so it can never show more than the
 * person is allowed to see.
 */
const route = useRoute();
const venueId = computed(() => String(route.params['venueId']));

const search = ref('');
const debounced = useDebouncedRef(search, 350);

const people = useResource(() => listVenuePeople(venueId.value, debounced.value || undefined));

onMounted(() => void people.load());
watch(debounced, () => void people.load());

const staff = computed<VenuePersonDto[]>(() => people.data.value?.staff ?? []);
const players = computed<VenuePersonDto[]>(() => people.data.value?.players ?? []);
const isEmpty = computed(() => staff.value.length === 0 && players.value.length === 0);

/** "3 de 5" reads better than a bare number when the point is who turns up. */
function attendance(person: VenuePersonDto): string {
  if (person.booked === 0) return 'ainda não jogou aqui';
  return `${person.attended} de ${person.booked} ${person.booked === 1 ? 'vez' : 'vezes'}`;
}
</script>

<template>
  <PullToRefresh :refresh="people.load">
    <div class="flex flex-col gap-4">
      <div class="relative">
        <AppIcon
          name="search"
          class="text-brand-400 pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <input
          v-model="search"
          type="search"
          placeholder="Buscar pelo nome"
          aria-label="Buscar pessoa pelo nome"
          class="border-brand-200 text-brand-900 placeholder:text-brand-400 min-h-11 w-full rounded-xl border bg-white py-2 pr-3 pl-11 text-base"
        />
      </div>

      <div v-if="people.isInitialLoading.value" class="flex flex-col gap-2">
        <SkeletonBlock v-for="index in 6" :key="index" class="h-16 rounded-2xl" />
      </div>

      <ErrorState
        v-else-if="people.error.value && !people.data.value"
        :message="people.error.value"
        :retrying="people.isFetching.value"
        @retry="people.load"
      />

      <EmptyState
        v-else-if="isEmpty"
        icon="users"
        :title="search ? 'Ninguém encontrado' : 'Ninguém ainda'"
        :description="
          search
            ? 'Tente outro nome.'
            : 'Quem confirmar presença numa sessão deste CT aparece aqui.'
        "
      />

      <template v-else>
        <!-- Only ever present for whoever runs the CT; a professor receives an
             empty list and this section simply does not render. -->
        <section v-if="staff.length > 0" class="flex flex-col gap-2">
          <h2 class="text-brand-500 px-1 text-xs font-semibold tracking-wide uppercase">
            Equipe do CT
          </h2>

          <ul class="flex flex-col gap-2">
            <li
              v-for="person in staff"
              :key="person.id"
              class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
            >
              <UserAvatar :name="person.name" :src="person.avatarUrl" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="text-brand-900 truncate text-sm font-semibold">{{ person.name }}</p>
                <p class="text-brand-500 text-xs">
                  {{ person.venueRole ? VENUE_ROLE_LABELS[person.venueRole] : '' }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-2">
          <h2 class="text-brand-500 px-1 text-xs font-semibold tracking-wide uppercase">
            Quem joga aqui · {{ players.length }}
          </h2>

          <ul class="flex flex-col gap-2">
            <li
              v-for="person in players"
              :key="person.id"
              class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
            >
              <UserAvatar :name="person.name" :src="person.avatarUrl" size="sm" />

              <div class="min-w-0 flex-1">
                <p class="text-brand-900 truncate text-sm font-semibold">{{ person.name }}</p>
                <p class="text-brand-500 truncate text-xs">
                  Veio {{ attendance(person) }}
                  <template v-if="person.lastSeenAt">
                    · última vez {{ formatRelativeMoment(person.lastSeenAt) }}
                  </template>
                </p>
              </div>

              <div class="flex shrink-0 flex-col items-end gap-1">
                <!-- The account label travels only to whoever may read it; a
                     professor gets null and nothing is shown. -->
                <span
                  v-if="person.role"
                  class="bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  {{ person.role === 'DAYUSE' ? 'Dayuse' : 'Aluno' }}
                </span>
                <span v-if="person.skillLevel" class="text-brand-400 text-xs">
                  {{ SKILL_LEVEL_LABELS[person.skillLevel] }}
                </span>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </PullToRefresh>
</template>
