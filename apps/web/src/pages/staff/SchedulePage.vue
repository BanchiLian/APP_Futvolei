<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import {
  SESSION_TYPES,
  type ScheduleTemplateDto,
  type ScheduleTemplateInput,
  type VenueStaffDto,
} from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import BottomSheet from '@/components/BottomSheet.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import SessionTypeBadge from '@/components/SessionTypeBadge.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import { useResource } from '@/composables/useResource';
import { useToast } from '@/composables/useToast';
import { normalizeApiError } from '@/services/http';
import {
  createTemplate,
  listSchedule,
  listStaff,
  removeTemplate,
  updateTemplate,
} from '@/services/staff';

/**
 * The weekly grid: what repeats every week at this CT.
 *
 * Sessions are generated from these rows, so a change here changes next week,
 * not the sessions people already answered. That is why removing a slot that has
 * history deactivates it instead of deleting it.
 */
const route = useRoute();
const toast = useToast();

const venueId = computed(() => String(route.params['venueId']));

const schedule = useResource(() => listSchedule(venueId.value));
const staff = useResource(() => listStaff(venueId.value));

onMounted(() => {
  void schedule.load();
  void staff.load();
});

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const byWeekday = computed(() => {
  const groups: Array<{ weekday: number; label: string; items: ScheduleTemplateDto[] }> = [];

  for (let weekday = 0; weekday < 7; weekday += 1) {
    const items = (schedule.data.value ?? []).filter((item) => item.weekday === weekday);
    if (items.length > 0) groups.push({ weekday, label: WEEKDAYS[weekday] ?? '', items });
  }

  return groups;
});

const professors = computed<VenueStaffDto[]>(() => staff.data.value ?? []);

// --- the editor ---

const sheetOpen = ref(false);
const editingId = ref<string | null>(null);
const isSaving = ref(false);

const form = reactive<ScheduleTemplateInput>({
  type: SESSION_TYPES.DAYUSE,
  weekday: 6,
  startTime: '08:00',
  endTime: '10:00',
  capacity: 16,
  title: null,
  responsibleId: null,
  isActive: true,
});

function openNew(): void {
  editingId.value = null;
  Object.assign(form, {
    type: SESSION_TYPES.DAYUSE,
    weekday: 6,
    startTime: '08:00',
    endTime: '10:00',
    capacity: 16,
    title: null,
    responsibleId: null,
    isActive: true,
  });
  sheetOpen.value = true;
}

function openEdit(item: ScheduleTemplateDto): void {
  editingId.value = item.id;
  Object.assign(form, {
    type: item.type,
    weekday: item.weekday,
    startTime: item.startTime,
    endTime: item.endTime,
    capacity: item.capacity,
    title: item.title,
    responsibleId: item.responsible?.id ?? null,
    isActive: item.isActive,
  });
  sheetOpen.value = true;
}

async function save(): Promise<void> {
  isSaving.value = true;

  try {
    if (editingId.value) {
      await updateTemplate(venueId.value, editingId.value, { ...form });
      toast.success('Horário atualizado.');
    } else {
      await createTemplate(venueId.value, { ...form });
      toast.success('Horário criado.');
    }

    sheetOpen.value = false;
    await schedule.load();
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isSaving.value = false;
  }
}

const removingId = ref<string | null>(null);

async function remove(item: ScheduleTemplateDto): Promise<void> {
  removingId.value = item.id;

  try {
    await removeTemplate(venueId.value, item.id);
    toast.success('Horário removido da grade.');
    await schedule.load();
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    removingId.value = null;
  }
}

/** An aula always needs someone answering for it; a dayuse does not. */
const needsResponsible = computed(() => form.type === SESSION_TYPES.AULA);
const canSave = computed(
  () =>
    form.startTime < form.endTime &&
    form.capacity > 0 &&
    (!needsResponsible.value || Boolean(form.responsibleId)),
);
</script>

<template>
  <div class="flex flex-col gap-4 pb-24">
    <p class="text-brand-500 text-sm">
      O que se repete toda semana neste CT. As sessões das próximas semanas são geradas a partir
      daqui.
    </p>

    <div v-if="schedule.isInitialLoading.value" class="flex flex-col gap-2">
      <SkeletonBlock v-for="index in 4" :key="index" class="h-16 rounded-2xl" />
    </div>

    <ErrorState
      v-else-if="schedule.error.value && !schedule.data.value"
      :message="schedule.error.value"
      :retrying="schedule.isFetching.value"
      @retry="schedule.load"
    />

    <EmptyState
      v-else-if="byWeekday.length === 0"
      icon="calendar"
      title="Grade vazia"
      description="Adicione os horários que se repetem toda semana."
    />

    <section v-for="group in byWeekday" :key="group.weekday" class="flex flex-col gap-2">
      <h2 class="text-brand-500 px-1 text-xs font-semibold tracking-wide uppercase">
        {{ group.label }}
      </h2>

      <ul class="flex flex-col gap-2">
        <li
          v-for="item in group.items"
          :key="item.id"
          class="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
          :class="{ 'opacity-60': !item.isActive }"
        >
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center gap-2">
              <SessionTypeBadge :type="item.type" />
              <span v-if="!item.isActive" class="text-brand-500 text-xs">pausado</span>
            </div>
            <p class="text-brand-900 text-sm font-semibold">
              {{ item.startTime }} – {{ item.endTime }} · {{ item.capacity }} vagas
            </p>
            <p v-if="item.responsible" class="text-brand-500 truncate text-xs">
              com {{ item.responsible.name }}
            </p>
          </div>

          <button
            type="button"
            class="tap-target press text-brand-500 rounded-xl"
            aria-label="Editar horário"
            @click="openEdit(item)"
          >
            <AppIcon name="edit" class="size-5" />
          </button>

          <button
            type="button"
            class="tap-target press text-danger-600 rounded-xl"
            aria-label="Remover horário"
            :disabled="removingId === item.id"
            @click="remove(item)"
          >
            <AppIcon name="x" class="size-5" />
          </button>
        </li>
      </ul>
    </section>

    <div
      class="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur lg:left-64"
    >
      <AppButton block @click="openNew">
        <AppIcon name="plus" class="size-5" />
        Novo horário
      </AppButton>
    </div>

    <BottomSheet
      v-model:open="sheetOpen"
      :title="editingId ? 'Editar horário' : 'Novo horário'"
      description="Isso vale para todas as semanas."
    >
      <div class="flex flex-col gap-4">
        <div class="flex gap-2">
          <button
            v-for="type in [SESSION_TYPES.AULA, SESSION_TYPES.DAYUSE]"
            :key="type"
            type="button"
            class="min-h-11 flex-1 rounded-xl text-sm font-semibold"
            :class="form.type === type ? 'bg-aula-600 text-white' : 'bg-brand-100 text-brand-700'"
            @click="form.type = type"
          >
            {{ type === SESSION_TYPES.AULA ? 'Aula' : 'Dayuse' }}
          </button>
        </div>

        <label class="flex flex-col gap-1">
          <span class="text-brand-700 text-sm font-medium">Dia da semana</span>
          <select
            v-model.number="form.weekday"
            class="border-brand-200 text-brand-900 min-h-11 rounded-xl border bg-white px-3 text-base"
          >
            <option v-for="(label, index) in WEEKDAYS" :key="label" :value="index">
              {{ label }}
            </option>
          </select>
        </label>

        <div class="flex gap-3">
          <label class="flex flex-1 flex-col gap-1">
            <span class="text-brand-700 text-sm font-medium">Começa</span>
            <input
              v-model="form.startTime"
              type="time"
              class="border-brand-200 text-brand-900 min-h-11 rounded-xl border bg-white px-3 text-base"
            />
          </label>
          <label class="flex flex-1 flex-col gap-1">
            <span class="text-brand-700 text-sm font-medium">Termina</span>
            <input
              v-model="form.endTime"
              type="time"
              class="border-brand-200 text-brand-900 min-h-11 rounded-xl border bg-white px-3 text-base"
            />
          </label>
        </div>

        <label class="flex flex-col gap-1">
          <span class="text-brand-700 text-sm font-medium">Vagas</span>
          <input
            v-model.number="form.capacity"
            type="number"
            min="1"
            max="200"
            class="border-brand-200 text-brand-900 min-h-11 rounded-xl border bg-white px-3 text-base"
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-brand-700 text-sm font-medium">
            Responsável
            <span v-if="!needsResponsible" class="text-brand-400 font-normal">(opcional)</span>
          </span>
          <select
            v-model="form.responsibleId"
            class="border-brand-200 text-brand-900 min-h-11 rounded-xl border bg-white px-3 text-base"
          >
            <option :value="null">Ninguém</option>
            <option v-for="person in professors" :key="person.userId" :value="person.userId">
              {{ person.name }}
            </option>
          </select>
          <!-- The API refuses anyone outside this CT's staff, so the list is the
               staff and nothing else. -->
          <span v-if="needsResponsible" class="text-brand-400 text-xs">
            Toda aula precisa de um professor da equipe deste CT.
          </span>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-brand-700 text-sm font-medium">Nome (opcional)</span>
          <input
            v-model="form.title"
            type="text"
            maxlength="120"
            placeholder="Ex.: Turma iniciante"
            class="border-brand-200 text-brand-900 min-h-11 rounded-xl border bg-white px-3 text-base"
          />
        </label>

        <AppButton block :disabled="!canSave" :loading="isSaving" @click="save">
          {{ editingId ? 'Salvar' : 'Adicionar à grade' }}
        </AppButton>
      </div>
    </BottomSheet>
  </div>
</template>
