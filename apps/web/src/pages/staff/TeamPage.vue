<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import {
  VENUE_ROLES,
  VENUE_ROLE_LABELS,
  type VenueRole,
  type StaffUserDto,
} from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import BottomSheet from '@/components/BottomSheet.vue';
import ErrorState from '@/components/ErrorState.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useDebouncedRef } from '@/composables/useDebouncedRef';
import { useResource } from '@/composables/useResource';
import { useToast } from '@/composables/useToast';
import { normalizeApiError } from '@/services/http';
import { listStaff, listUsers, removeStaff, setStaff } from '@/services/staff';

/**
 * Who runs this CT.
 *
 * Adding someone here is what gives them authority, and only here: nothing about
 * their account changes, and nothing they gain reaches any other CT.
 */
const route = useRoute();
const toast = useToast();

const venueId = computed(() => String(route.params['venueId']));
const team = useResource(() => listStaff(venueId.value));

onMounted(() => void team.load());

const members = computed(() => team.data.value ?? []);

// --- adding someone ---

const sheetOpen = ref(false);
const search = ref('');
const debounced = useDebouncedRef(search, 350);
const role = ref<VenueRole>(VENUE_ROLES.PROFESSOR);
const isSaving = ref(false);

const found = useResource(() => listUsers(debounced.value || undefined));

watch(debounced, () => {
  if (debounced.value.length >= 2) void found.load();
});

/** People already on the team are not offered again. */
const candidates = computed<StaffUserDto[]>(() => {
  const taken = new Set(members.value.map((member) => member.userId));
  return (found.data.value?.data ?? []).filter((user) => !taken.has(user.id));
});

async function add(user: StaffUserDto): Promise<void> {
  isSaving.value = true;

  try {
    team.data.value = await setStaff(venueId.value, { userId: user.id, role: role.value });
    toast.success(`${user.name} agora é ${VENUE_ROLE_LABELS[role.value].toLowerCase()}.`);
    sheetOpen.value = false;
    search.value = '';
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isSaving.value = false;
  }
}

async function changeRole(userId: string, next: VenueRole): Promise<void> {
  try {
    team.data.value = await setStaff(venueId.value, { userId, role: next });
    toast.success('Função atualizada.');
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  }
}

const removingId = ref<string | null>(null);

async function remove(userId: string, name: string): Promise<void> {
  removingId.value = userId;

  try {
    team.data.value = await removeStaff(venueId.value, userId);
    toast.success(`${name} saiu da equipe.`);
  } catch (error) {
    // The API refuses to leave a CT with no owner; it says so, and so do we.
    toast.error(normalizeApiError(error).message);
  } finally {
    removingId.value = null;
  }
}

const ROLE_OPTIONS: VenueRole[] = [VENUE_ROLES.OWNER, VENUE_ROLES.PROFESSOR];
</script>

<template>
  <div class="flex flex-col gap-4 pb-24">
    <p class="text-brand-500 text-sm">
      Quem está aqui manda neste CT e em nenhum outro. O dono cuida da grade, da equipe e das
      sessões; o professor marca a presença das sessões pelas quais responde.
    </p>

    <div v-if="team.isInitialLoading.value" class="flex flex-col gap-2">
      <SkeletonBlock v-for="index in 3" :key="index" class="h-16 rounded-2xl" />
    </div>

    <ErrorState
      v-else-if="team.error.value && !team.data.value"
      :message="team.error.value"
      :retrying="team.isFetching.value"
      @retry="team.load"
    />

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="member in members"
        :key="member.userId"
        class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
      >
        <UserAvatar :name="member.name" :src="member.avatarUrl" size="sm" />

        <div class="min-w-0 flex-1">
          <p class="text-brand-900 truncate text-sm font-semibold">{{ member.name }}</p>
          <select
            :value="member.role"
            class="text-brand-500 -ml-1 bg-transparent text-xs"
            :aria-label="`Função de ${member.name}`"
            @change="
              changeRole(member.userId, ($event.target as HTMLSelectElement).value as VenueRole)
            "
          >
            <option v-for="option in ROLE_OPTIONS" :key="option" :value="option">
              {{ VENUE_ROLE_LABELS[option] }}
            </option>
          </select>
        </div>

        <button
          type="button"
          class="tap-target press text-danger-600 rounded-xl"
          :aria-label="`Remover ${member.name} da equipe`"
          :disabled="removingId === member.userId"
          @click="remove(member.userId, member.name)"
        >
          <AppIcon name="x" class="size-5" />
        </button>
      </li>
    </ul>

    <div
      class="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur lg:left-64"
    >
      <AppButton block @click="sheetOpen = true">
        <AppIcon name="plus" class="size-5" />
        Adicionar à equipe
      </AppButton>
    </div>

    <BottomSheet
      v-model:open="sheetOpen"
      title="Adicionar à equipe"
      description="Procure a pessoa pelo nome ou e-mail."
    >
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          <button
            v-for="option in ROLE_OPTIONS"
            :key="option"
            type="button"
            class="min-h-11 flex-1 rounded-xl text-sm font-semibold"
            :class="role === option ? 'bg-aula-600 text-white' : 'bg-brand-100 text-brand-700'"
            @click="role = option"
          >
            {{ VENUE_ROLE_LABELS[option] }}
          </button>
        </div>

        <input
          v-model="search"
          type="search"
          placeholder="Nome ou e-mail"
          class="border-brand-200 text-brand-900 placeholder:text-brand-400 min-h-11 rounded-xl border bg-white px-3 text-base"
        />

        <p v-if="search.length < 2" class="text-brand-400 text-xs">Digite ao menos 2 letras.</p>

        <ul v-else class="flex max-h-72 flex-col gap-2 overflow-y-auto">
          <li v-for="user in candidates" :key="user.id">
            <button
              type="button"
              class="press hover:bg-brand-50 flex w-full items-center gap-3 rounded-xl p-2 text-left"
              :disabled="isSaving"
              @click="add(user)"
            >
              <UserAvatar :name="user.name" :src="user.avatarUrl" size="sm" />
              <span class="min-w-0 flex-1">
                <span class="text-brand-900 block truncate text-sm font-medium">{{
                  user.name
                }}</span>
                <span class="text-brand-500 block truncate text-xs">{{ user.email }}</span>
              </span>
              <AppIcon name="plus" class="text-brand-400 size-5 shrink-0" />
            </button>
          </li>
          <li v-if="candidates.length === 0" class="text-brand-400 px-2 py-4 text-center text-sm">
            Ninguém encontrado.
          </li>
        </ul>
      </div>
    </BottomSheet>
  </div>
</template>
