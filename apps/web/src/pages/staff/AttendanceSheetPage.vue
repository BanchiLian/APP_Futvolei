<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import {
  BOOKING_STATUSES,
  errorMessageFor,
  type AttendanceMark,
  type AttendanceSheetDto,
} from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import SessionTypeBadge from '@/components/SessionTypeBadge.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useResource } from '@/composables/useResource';
import { useToast } from '@/composables/useToast';
import { formatRelativeDay, formatRelativeMoment, formatTimeRange } from '@/lib/format';
import { tapFeedback } from '@/lib/haptics';
import { normalizeApiError } from '@/services/http';
import { getAttendanceSheet, markAttendance } from '@/services/attendance';

/**
 * The checklist, as it is actually used: standing on the sand, one hand, sun on
 * the screen. Big targets, three obvious states, and one save at the end — the
 * API takes the whole sheet and the marks are absolute, so a tap never races a
 * request and a bad signal never double-counts anyone.
 */
const route = useRoute();
const toast = useToast();

const sessionId = computed(() => String(route.params['id']));
const sheet = useResource<AttendanceSheetDto>(() => getAttendanceSheet(sessionId.value));

/** Pending marks, keyed by person. Empty means "nothing changed yet". */
const draft = ref<Record<string, AttendanceMark>>({});
const isSaving = ref(false);

onMounted(() => void sheet.load());
watch(sessionId, () => {
  draft.value = {};
  void sheet.load();
});

const data = computed(() => sheet.data.value);
const entries = computed(() => data.value?.entries ?? []);
const canEdit = computed(() => data.value?.editability.canEdit ?? false);

/** Who is on the list to be marked; the waitlist is shown apart. */
const expected = computed(() =>
  entries.value.filter((entry) => entry.status !== BOOKING_STATUSES.LISTA_ESPERA),
);
const waitlist = computed(() =>
  entries.value.filter((entry) => entry.status === BOOKING_STATUSES.LISTA_ESPERA),
);

/** What a row shows: the pending mark if the user touched it, else the server's. */
function markOf(userId: string): AttendanceMark {
  const pending = draft.value[userId];
  if (pending) return pending;

  const stored = entries.value.find((entry) => entry.userId === userId)?.status;
  return stored === BOOKING_STATUSES.PRESENTE || stored === BOOKING_STATUSES.FALTOU
    ? stored
    : BOOKING_STATUSES.CONFIRMADA;
}

function setMark(userId: string, mark: AttendanceMark): void {
  if (!canEdit.value) return;

  tapFeedback();
  draft.value = { ...draft.value, [userId]: mark };
}

const pendingCount = computed(
  () =>
    Object.entries(draft.value).filter(
      ([userId, mark]) => entries.value.find((entry) => entry.userId === userId)?.status !== mark,
    ).length,
);

/** Live totals, so the header reacts before anything is saved. */
const totals = computed(() => {
  let present = 0;
  let absent = 0;

  for (const entry of expected.value) {
    const mark = markOf(entry.userId);
    if (mark === BOOKING_STATUSES.PRESENTE) present += 1;
    else if (mark === BOOKING_STATUSES.FALTOU) absent += 1;
  }

  return { present, absent, pending: expected.value.length - present - absent };
});

const blockedMessage = computed(() => {
  const editability = data.value?.editability;
  if (!editability || editability.canEdit) return null;

  if (!editability.blockedReason) return 'A lista não pode ser editada agora.';

  return errorMessageFor(editability.blockedReason);
});

async function save(): Promise<void> {
  const changes = Object.entries(draft.value)
    .filter(([userId, mark]) => entries.value.find((e) => e.userId === userId)?.status !== mark)
    .map(([userId, status]) => ({ userId, status }));

  if (changes.length === 0) return;

  isSaving.value = true;

  try {
    sheet.data.value = await markAttendance(sessionId.value, changes);
    draft.value = {};
    toast.success('Lista salva.');
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isSaving.value = false;
  }
}

const MARKS: Array<{ value: AttendanceMark; label: string; active: string }> = [
  { value: BOOKING_STATUSES.PRESENTE, label: 'Veio', active: 'bg-aula-600 text-white' },
  { value: BOOKING_STATUSES.FALTOU, label: 'Faltou', active: 'bg-danger-600 text-white' },
  { value: BOOKING_STATUSES.CONFIRMADA, label: '—', active: 'bg-brand-200 text-brand-800' },
];
</script>

<template>
  <div class="flex flex-col gap-4 pb-24">
    <div v-if="sheet.isInitialLoading.value" class="flex flex-col gap-3">
      <SkeletonBlock class="h-24 rounded-2xl" />
      <SkeletonBlock v-for="index in 5" :key="index" class="h-16 rounded-2xl" />
    </div>

    <ErrorState
      v-else-if="sheet.error.value && !data"
      :message="sheet.error.value"
      :retrying="sheet.isFetching.value"
      @retry="sheet.load"
    />

    <template v-else-if="data">
      <!-- Which session this is, so nobody marks the wrong one. -->
      <header class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div class="mb-2 flex items-center gap-2">
          <SessionTypeBadge :type="data.session.type" />
        </div>

        <p class="text-brand-900 text-xl font-semibold">
          {{ formatTimeRange(data.session.startsAt, data.session.endsAt) }}
        </p>
        <p class="text-brand-600 text-sm">
          {{ formatRelativeDay(data.session.startsAt) }} · {{ data.session.venue.name }}
        </p>

        <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
          <div class="bg-aula-50 rounded-xl py-2">
            <dt class="text-brand-600 text-xs">Vieram</dt>
            <dd class="text-aula-700 text-lg font-bold">{{ totals.present }}</dd>
          </div>
          <div class="bg-danger-50 rounded-xl py-2">
            <dt class="text-brand-600 text-xs">Faltaram</dt>
            <dd class="text-danger-700 text-lg font-bold">{{ totals.absent }}</dd>
          </div>
          <div class="bg-brand-100 rounded-xl py-2">
            <dt class="text-brand-600 text-xs">Sem marcar</dt>
            <dd class="text-brand-800 text-lg font-bold">{{ totals.pending }}</dd>
          </div>
        </dl>
      </header>

      <!-- Why the list is locked, in the user's words, never a bare disabled state. -->
      <p
        v-if="blockedMessage"
        class="bg-dayuse-50 text-dayuse-900 flex items-start gap-2 rounded-xl p-3 text-sm"
      >
        <AppIcon name="alert" class="mt-0.5 size-4 shrink-0" />
        <span>
          {{ blockedMessage }}
          <template v-if="data.editability.blockedReason === 'ATTENDANCE_WINDOW_NOT_OPEN'">
            Abre {{ formatRelativeMoment(data.editability.opensAt) }}.
          </template>
        </span>
      </p>

      <EmptyState
        v-if="expected.length === 0"
        icon="users"
        title="Ninguém confirmou"
        description="Quando alguém responder Vou, aparece aqui para você marcar."
      />

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="entry in expected"
          :key="entry.userId"
          class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
        >
          <UserAvatar :name="entry.name" :src="entry.avatarUrl" size="sm" />

          <div class="min-w-0 flex-1">
            <p class="text-brand-900 truncate text-sm font-semibold">{{ entry.name }}</p>
            <p v-if="entry.isWalkIn" class="text-dayuse-700 text-xs">Chegou sem avisar</p>
          </div>

          <div class="flex shrink-0 gap-1" role="group" :aria-label="`Presença de ${entry.name}`">
            <button
              v-for="mark in MARKS"
              :key="mark.value"
              type="button"
              class="min-h-11 min-w-11 rounded-xl px-2 text-xs font-semibold transition"
              :class="
                markOf(entry.userId) === mark.value
                  ? mark.active
                  : 'bg-brand-50 text-brand-500 hover:bg-brand-100'
              "
              :disabled="!canEdit"
              :aria-pressed="markOf(entry.userId) === mark.value"
              @click="setMark(entry.userId, mark.value)"
            >
              {{ mark.label }}
            </button>
          </div>
        </li>
      </ul>

      <!-- The waitlist is shown but not markable: they do not hold a seat. -->
      <section v-if="waitlist.length > 0" class="flex flex-col gap-2">
        <h2 class="text-brand-500 px-1 text-xs font-semibold tracking-wide uppercase">
          Lista de espera
        </h2>
        <ul class="flex flex-col gap-2">
          <li
            v-for="entry in waitlist"
            :key="entry.userId"
            class="flex items-center gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-black/5"
          >
            <UserAvatar :name="entry.name" :src="entry.avatarUrl" size="sm" />
            <p class="text-brand-700 min-w-0 flex-1 truncate text-sm">{{ entry.name }}</p>
            <span class="text-brand-500 text-xs">{{ entry.waitlistPosition }}º</span>
          </li>
        </ul>
      </section>
    </template>

    <!-- Saving sits above the thumb and only appears when there is something to save. -->
    <div
      v-if="canEdit && pendingCount > 0"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur lg:left-64"
    >
      <AppButton block :loading="isSaving" @click="save">
        Salvar {{ pendingCount }} {{ pendingCount === 1 ? 'marcação' : 'marcações' }}
      </AppButton>
    </div>
  </div>
</template>
