<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import type { StaffUserDto, VenueCreateInput, VenueWriteInput } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import BottomSheet from '@/components/BottomSheet.vue';
import EmptyState from '@/components/EmptyState.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import VenueForm from '@/components/VenueForm.vue';
import { useDebouncedRef } from '@/composables/useDebouncedRef';
import { useResource } from '@/composables/useResource';
import { useToast } from '@/composables/useToast';
import { normalizeApiError } from '@/services/http';
import { createVenue, listUsers, listVenues } from '@/services/staff';

/**
 * The network: every CT, and the only place a new one is created.
 *
 * Creating a CT is a decision about the product, not about an arena, so it sits
 * with the super admin. A CT is handed to an owner as it is created, because a
 * CT nobody runs is a CT nobody can fix.
 */
const toast = useToast();

const search = ref('');
const debounced = useDebouncedRef(search, 350);

const venues = useResource(() => listVenues(debounced.value || undefined));

onMounted(() => void venues.load());
watch(debounced, () => void venues.load());

const list = computed(() => venues.data.value ?? []);

// --- creating one ---

const sheetOpen = ref(false);
const isSaving = ref(false);
const ownerSearch = ref('');
const ownerDebounced = useDebouncedRef(ownerSearch, 350);
const owner = ref<StaffUserDto | null>(null);

const people = useResource(() => listUsers(ownerDebounced.value || undefined));

watch(ownerDebounced, () => {
  if (ownerDebounced.value.length >= 2) void people.load();
});

async function create(input: VenueWriteInput): Promise<void> {
  isSaving.value = true;

  try {
    const payload: VenueCreateInput = { ...input, ownerId: owner.value?.id ?? null };
    const created = await createVenue(payload);

    toast.success(
      owner.value
        ? `${created.name} criado, com ${owner.value.name} como dono.`
        : `${created.name} criado.`,
    );

    sheetOpen.value = false;
    owner.value = null;
    ownerSearch.value = '';
    await venues.load();
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 pb-24">
    <div class="relative">
      <AppIcon
        name="search"
        class="text-brand-400 pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
      />
      <input
        v-model="search"
        type="search"
        placeholder="Buscar CT pelo nome"
        aria-label="Buscar CT pelo nome"
        class="border-brand-200 text-brand-900 placeholder:text-brand-400 min-h-11 w-full rounded-xl border bg-white py-2 pr-3 pl-11 text-base"
      />
    </div>

    <div v-if="venues.isInitialLoading.value" class="flex flex-col gap-2">
      <SkeletonBlock v-for="index in 5" :key="index" class="h-16 rounded-2xl" />
    </div>

    <EmptyState
      v-else-if="list.length === 0"
      icon="pin"
      :title="search ? 'Nenhum CT encontrado' : 'Busque um CT'"
      :description="
        search ? 'Tente outro nome.' : 'Digite o nome de um CT para administrá-lo, ou crie um novo.'
      "
    />

    <ul v-else class="flex flex-col gap-2">
      <li v-for="venue in list" :key="venue.id">
        <RouterLink
          :to="{ name: 'staff-venue', params: { venueId: venue.id } }"
          class="press flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
        >
          <AppIcon name="pin" class="text-brand-400 size-5 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="text-brand-900 truncate text-sm font-semibold">{{ venue.name }}</p>
            <p class="text-brand-500 truncate text-xs">
              {{ venue.city }}/{{ venue.state }}
              <span v-if="venue.source === 'OSM'"> · do OpenStreetMap</span>
            </p>
          </div>
          <AppIcon name="chevron-right" class="text-brand-400 size-5 shrink-0" />
        </RouterLink>
      </li>
    </ul>

    <div
      class="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur lg:left-64"
    >
      <AppButton block @click="sheetOpen = true">
        <AppIcon name="plus" class="size-5" />
        Novo CT
      </AppButton>
    </div>

    <BottomSheet
      v-model:open="sheetOpen"
      title="Novo CT"
      description="Escolha quem vai administrá-lo."
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <span class="text-brand-700 text-sm font-medium">Dono do CT</span>

          <div v-if="owner" class="bg-brand-50 flex items-center gap-3 rounded-xl p-2">
            <UserAvatar :name="owner.name" :src="owner.avatarUrl" size="sm" />
            <span class="text-brand-900 min-w-0 flex-1 truncate text-sm">{{ owner.name }}</span>
            <button
              type="button"
              class="tap-target press text-brand-500 rounded-lg"
              aria-label="Trocar dono"
              @click="owner = null"
            >
              <AppIcon name="x" class="size-4" />
            </button>
          </div>

          <template v-else>
            <input
              v-model="ownerSearch"
              type="search"
              placeholder="Nome ou e-mail"
              class="border-brand-200 text-brand-900 min-h-11 rounded-xl border bg-white px-3 text-base"
            />
            <ul v-if="ownerSearch.length >= 2" class="flex max-h-48 flex-col gap-1 overflow-y-auto">
              <li v-for="person in people.data.value?.data ?? []" :key="person.id">
                <button
                  type="button"
                  class="press hover:bg-brand-50 flex w-full items-center gap-2 rounded-lg p-2 text-left"
                  @click="owner = person"
                >
                  <UserAvatar :name="person.name" :src="person.avatarUrl" size="sm" />
                  <span class="text-brand-800 min-w-0 flex-1 truncate text-sm">{{
                    person.name
                  }}</span>
                </button>
              </li>
            </ul>
            <p class="text-brand-400 text-xs">
              Pode ficar sem dono por enquanto — você continua administrando.
            </p>
          </template>
        </div>

        <VenueForm :saving="isSaving" submit-label="Criar CT" @submit="create" />
      </div>
    </BottomSheet>
  </div>
</template>
