<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import type { CommunityMemberDto } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useDebouncedRef } from '@/composables/useDebouncedRef';
import { useResource } from '@/composables/useResource';
import { SKILL_LEVEL_LABELS } from '@/lib/skillLevel';
import { listCommunity } from '@/services/community';

/**
 * Who else plays. Only the members who kept "Aparecer na comunidade" on, and only
 * name, photo and level — never contact details or access role.
 */
const search = ref('');
const debouncedSearch = useDebouncedRef(search, 350);

const page = ref(1);
const members = ref<CommunityMemberDto[]>([]);

const resource = useResource(() => listCommunity({ q: debouncedSearch.value, page: page.value }));

async function loadPage(nextPage: number): Promise<void> {
  page.value = nextPage;
  await resource.load();

  const result = resource.data.value;
  if (!result) return;

  // Page 1 replaces; later pages append, so the list grows as the user scrolls.
  members.value = nextPage === 1 ? result.data : [...members.value, ...result.data];
}

onMounted(() => void loadPage(1));
watch(debouncedSearch, () => void loadPage(1));

const total = computed(() => resource.data.value?.meta.total ?? 0);
const hasMore = computed(() => members.value.length < total.value);
const isFirstLoad = computed(() => resource.isInitialLoading.value && members.value.length === 0);

async function refresh(): Promise<void> {
  await loadPage(1);
}
</script>
<template>
  <PullToRefresh :refresh="refresh">
    <div class="flex flex-col gap-4">
      <div class="relative">
        <AppIcon
          name="search"
          class="text-brand-400 pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <input
          v-model="search"
          type="search"
          class="text-brand-900 placeholder:text-brand-400 border-brand-200 focus:border-aula-600 min-h-11 w-full rounded-xl border bg-white py-2 pr-3 pl-11 text-base outline-none"
          placeholder="Buscar por nome"
          aria-label="Buscar pessoas pelo nome"
        />
      </div>

      <div v-if="isFirstLoad" class="flex flex-col gap-2">
        <SkeletonBlock v-for="index in 6" :key="index" class="h-16 rounded-2xl" />
      </div>

      <ErrorState
        v-else-if="resource.error.value && members.length === 0"
        :message="resource.error.value"
        :retrying="resource.isFetching.value"
        @retry="refresh"
      />

      <EmptyState
        v-else-if="members.length === 0"
        icon="users"
        :title="search ? 'Ninguém encontrado' : 'Ainda não há pessoas por aqui'"
        :description="
          search
            ? 'Tente procurar por outro nome.'
            : 'Quando outras pessoas se cadastrarem, elas aparecem aqui.'
        "
      />

      <template v-else>
        <p class="text-brand-500 text-xs">
          {{ total }} {{ total === 1 ? 'pessoa' : 'pessoas' }} em Pessoas
        </p>

        <ul class="flex flex-col gap-2">
          <li
            v-for="member in members"
            :key="member.id"
            class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
          >
            <UserAvatar :name="member.name" :src="member.avatarUrl" />
            <div class="min-w-0 flex-1">
              <p class="text-brand-900 truncate text-sm font-semibold">{{ member.name }}</p>
              <p v-if="member.skillLevel" class="text-brand-500 text-xs">
                {{ SKILL_LEVEL_LABELS[member.skillLevel] }}
              </p>
            </div>
          </li>
        </ul>

        <AppButton
          v-if="hasMore"
          variant="secondary"
          block
          :loading="resource.isFetching.value"
          @click="loadPage(page + 1)"
        >
          Carregar mais
        </AppButton>
      </template>

      <p class="text-brand-400 px-2 text-center text-xs">
        Você controla se aparece aqui, no seu perfil.
      </p>
    </div>
  </PullToRefresh>
</template>
