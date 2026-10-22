<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import {
  ASSIGNABLE_ROLES,
  ASSIGNABLE_ROLE_LABELS,
  isAssignableRole,
  type AssignableRole,
  type StaffUserDto,
} from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useDebouncedRef } from '@/composables/useDebouncedRef';
import { useResource } from '@/composables/useResource';
import { useToast } from '@/composables/useToast';
import { normalizeApiError } from '@/services/http';
import { listUsers, setUserRole } from '@/services/staff';

/**
 * Every account, and the access role each one holds.
 *
 * The super admin's screen alone: nobody else defines the hierarchy. Sign-ups
 * arrive as Dayuse and stay that way until promoted here. Who owns or teaches at
 * a CT is set on that CT's Equipe screen, reached through Rede.
 */
const toast = useToast();

const search = ref('');
const debounced = useDebouncedRef(search, 350);

const users = useResource(() =>
  listUsers(debounced.value.length >= 2 ? debounced.value : undefined),
);

onMounted(() => void users.load());
watch(debounced, () => void users.load());

const list = computed(() => users.data.value?.data ?? []);
const savingId = ref<string | null>(null);

async function changeRole(user: StaffUserDto, next: string): Promise<void> {
  if (!isAssignableRole(next) || next === user.role) return;

  savingId.value = user.id;

  try {
    const updated = await setUserRole(user.id, next);
    Object.assign(user, updated);
    toast.success(`${user.name} agora é ${ASSIGNABLE_ROLE_LABELS[next].toLowerCase()}.`);
  } catch (error) {
    toast.error(normalizeApiError(error).message);
    await users.load();
  } finally {
    savingId.value = null;
  }
}

function labelOf(role: string): string {
  return isAssignableRole(role) ? ASSIGNABLE_ROLE_LABELS[role as AssignableRole] : role;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="relative">
      <AppIcon
        name="search"
        class="text-brand-400 pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
      />
      <input
        v-model="search"
        type="search"
        placeholder="Buscar pelo nome ou e-mail"
        aria-label="Buscar pelo nome ou e-mail"
        class="border-brand-200 text-brand-900 placeholder:text-brand-400 min-h-11 w-full rounded-xl border bg-white py-2 pr-3 pl-11 text-base"
      />
    </div>

    <div v-if="users.isInitialLoading.value" class="flex flex-col gap-2">
      <SkeletonBlock v-for="index in 6" :key="index" class="h-16 rounded-2xl" />
    </div>

    <ErrorState
      v-else-if="users.error.value && !users.data.value"
      :message="users.error.value"
      :retrying="users.isFetching.value"
      @retry="users.load"
    />

    <EmptyState
      v-else-if="list.length === 0"
      icon="users"
      title="Ninguém encontrado"
      description="Tente outro nome ou e-mail."
    />

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="user in list"
        :key="user.id"
        class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
      >
        <UserAvatar :name="user.name" :src="user.avatarUrl" size="sm" />

        <div class="min-w-0 flex-1">
          <p class="text-brand-900 truncate text-sm font-semibold">{{ user.name }}</p>
          <p class="text-brand-500 truncate text-xs">{{ user.email }}</p>
        </div>

        <select
          :value="user.role"
          class="border-brand-200 text-brand-800 min-h-11 shrink-0 rounded-xl border bg-white px-2 text-sm"
          :aria-label="`Perfil de ${user.name}`"
          :disabled="savingId === user.id"
          @change="changeRole(user, ($event.target as HTMLSelectElement).value)"
        >
          <option v-if="!isAssignableRole(user.role)" :value="user.role" disabled>
            {{ labelOf(user.role) }}
          </option>
          <option v-for="option in ASSIGNABLE_ROLES" :key="option" :value="option">
            {{ ASSIGNABLE_ROLE_LABELS[option] }}
          </option>
        </select>
      </li>
    </ul>
  </div>
</template>
