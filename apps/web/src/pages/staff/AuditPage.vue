<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import type { AuditEntryDto } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useResource } from '@/composables/useResource';
import { formatRelativeMoment } from '@/lib/format';
import { listAudit } from '@/services/staff';

/**
 * The audit log.
 *
 * It was always being written and nobody could read it. Only the super admin
 * can: it records who did what across the whole network, which is not a CT
 * owner's business.
 */
const page = ref(1);
const entries = ref<AuditEntryDto[]>([]);

const audit = useResource(() => listAudit(page.value));

async function loadPage(next: number): Promise<void> {
  page.value = next;
  await audit.load();

  const result = audit.data.value;
  if (!result) return;

  entries.value = next === 1 ? result.data : [...entries.value, ...result.data];
}

onMounted(() => void loadPage(1));

const total = computed(() => audit.data.value?.meta.total ?? 0);
const hasMore = computed(() => entries.value.length < total.value);

/** Plain-language names for the actions that happen most. */
const LABELS: Record<string, string> = {
  'auth.login': 'entrou',
  'auth.logout': 'saiu',
  'auth.blocked.inactive': 'tentou entrar com conta desativada',
  'authz.blocked': 'tentou algo sem permissão',
  'attendance.marked': 'marcou presença',
  'attendance.walk_in': 'adicionou quem chegou sem avisar',
  'session.cancelled': 'cancelou uma sessão',
  'schedule.created': 'criou um horário',
  'schedule.updated': 'alterou um horário',
  'schedule.deleted': 'apagou um horário',
  'schedule.deactivated': 'pausou um horário',
  'venue.created': 'criou um CT',
  'venue.updated': 'alterou um CT',
  'venue.staff.set': 'mudou a equipe de um CT',
  'venue.staff.removed': 'tirou alguém da equipe',
  'settings.updated': 'mudou as configurações',
  'super_admin.created': 'criou o super admin',
};

function describe(entry: AuditEntryDto): string {
  return LABELS[entry.action] ?? entry.action;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="audit.isInitialLoading.value && entries.length === 0" class="flex flex-col gap-2">
      <SkeletonBlock v-for="index in 6" :key="index" class="h-14 rounded-xl" />
    </div>

    <ErrorState
      v-else-if="audit.error.value && entries.length === 0"
      :message="audit.error.value"
      :retrying="audit.isFetching.value"
      @retry="() => loadPage(1)"
    />

    <EmptyState
      v-else-if="entries.length === 0"
      icon="lock"
      title="Nada registrado"
      description="As ações importantes aparecem aqui."
    />

    <template v-else>
      <p class="text-brand-500 px-1 text-xs">{{ total }} registros</p>

      <ul class="flex flex-col gap-2">
        <li
          v-for="entry in entries"
          :key="entry.id"
          class="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5"
        >
          <UserAvatar
            v-if="entry.actor"
            :name="entry.actor.name"
            :src="entry.actor.avatarUrl"
            size="sm"
          />

          <div class="min-w-0 flex-1">
            <p class="text-brand-900 text-sm">
              <span class="font-semibold">{{ entry.actor?.name ?? 'Sistema' }}</span>
              {{ describe(entry) }}
            </p>
            <p class="text-brand-400 text-xs">
              {{ formatRelativeMoment(entry.createdAt) }}
              <span v-if="entry.ip"> · {{ entry.ip }}</span>
            </p>
          </div>
        </li>
      </ul>

      <AppButton
        v-if="hasMore"
        variant="secondary"
        block
        :loading="audit.isFetching.value"
        @click="loadPage(page + 1)"
      >
        Carregar mais
      </AppButton>
    </template>
  </div>
</template>
