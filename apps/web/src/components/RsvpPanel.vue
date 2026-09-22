<script setup lang="ts">
import { computed, ref } from 'vue';

import { PERMISSIONS, SESSION_TYPES, type SessionDetailDto } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import BottomSheet from '@/components/BottomSheet.vue';
import type { IconName } from '@/components/icons';
import { useCan } from '@/composables/useCan';
import { useRsvp } from '@/composables/useRsvp';
import { type RsvpAction, resolveRsvpView } from '@/lib/rsvpState';

/**
 * The Vou / Não vou control, shared by the home card and the session screen.
 * What it offers comes from `resolveRsvpView`; what actually happens is decided
 * by the server and handed back through `update`.
 */
const props = withDefaults(defineProps<{ session: SessionDetailDto; compact?: boolean }>(), {
  compact: false,
});
const emit = defineEmits<{ update: [session: SessionDetailDto] }>();

const { can } = useCan();
const { answer, pending } = useRsvp();

const view = computed(() => resolveRsvpView(props.session));

// Presentation only: the API refuses the answer anyway if the permission is missing.
const mayAnswer = computed(() =>
  can(
    props.session.type === SESSION_TYPES.AULA
      ? PERMISSIONS.SESSION_RSVP_AULA
      : PERMISSIONS.SESSION_RSVP_DAYUSE,
  ),
);

const confirmOpen = ref(false);

const statusStyle = computed<{ icon: IconName; tone: string }>(() => {
  switch (view.value.tone) {
    case 'cancelled':
      return { icon: 'ban', tone: 'bg-danger-50 text-danger-700' };
    case 'not-open':
      return { icon: 'clock', tone: 'bg-brand-100 text-brand-700' };
    case 'blocked':
      return { icon: 'lock', tone: 'bg-brand-100 text-brand-700' };
    case 'finished':
      return { icon: 'history', tone: 'bg-brand-100 text-brand-700' };
    default:
      break;
  }
  switch (view.value.answer) {
    case 'going':
      return { icon: 'check', tone: 'bg-success-50 text-success-700' };
    case 'waitlist':
      return { icon: 'list', tone: 'bg-dayuse-100 text-dayuse-800' };
    case 'not-going':
      return { icon: 'x', tone: 'bg-brand-100 text-brand-700' };
    default:
      return { icon: 'clock', tone: 'bg-aula-50 text-aula-700' };
  }
});

async function send(action: RsvpAction): Promise<void> {
  if (action.needsConfirmation) {
    confirmOpen.value = true;
    return;
  }
  const updated = await answer(props.session.id, action.response);
  if (updated) emit('update', updated);
}

async function confirmNotGoing(): Promise<void> {
  const updated = await answer(props.session.id, 'NAO_VOU');
  confirmOpen.value = false;
  if (updated) emit('update', updated);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-start gap-3 rounded-xl p-3" :class="statusStyle.tone" role="status">
      <AppIcon :name="statusStyle.icon" class="mt-0.5 size-5 shrink-0" :stroke-width="2.2" />
      <div class="min-w-0">
        <p class="text-sm font-semibold">{{ view.headline }}</p>
        <p v-if="view.detail && !compact" class="mt-0.5 text-sm opacity-90">{{ view.detail }}</p>
      </div>
    </div>

    <div v-if="mayAnswer && (view.primary || view.secondary)" class="flex gap-2">
      <AppButton
        v-if="view.secondary"
        variant="secondary"
        class="flex-1"
        :size="compact ? 'md' : 'lg'"
        :loading="pending === 'NAO_VOU' && !confirmOpen"
        :disabled="pending !== null"
        @click="send(view.secondary)"
      >
        {{ view.secondary.label }}
      </AppButton>
      <AppButton
        v-if="view.primary"
        class="flex-[1.4]"
        :variant="view.isFull ? 'waitlist' : 'success'"
        :size="compact ? 'md' : 'lg'"
        :loading="pending === 'VOU'"
        :disabled="pending !== null"
        @click="send(view.primary)"
      >
        <AppIcon :name="view.isFull ? 'list' : 'check'" class="size-5" :stroke-width="2.4" />
        {{ view.primary.label }}
      </AppButton>
    </div>

    <p v-if="view.detail && compact && view.tone === 'open'" class="text-brand-500 text-xs">
      {{ view.detail }}
    </p>

    <BottomSheet
      v-model:open="confirmOpen"
      :title="view.answer === 'waitlist' ? 'Sair da lista de espera?' : 'Confirmar “Não vou”?'"
      :description="
        view.answer === 'waitlist'
          ? 'Você perde sua posição na fila. Se mudar de ideia depois, volta para o fim da lista.'
          : 'Sua vaga será liberada para o próximo da lista de espera.'
      "
    >
      <div class="flex flex-col gap-2">
        <AppButton
          block
          variant="danger"
          size="lg"
          :loading="pending === 'NAO_VOU'"
          @click="confirmNotGoing"
        >
          {{ view.answer === 'waitlist' ? 'Sair da lista' : 'Não vou' }}
        </AppButton>
        <AppButton block variant="ghost" size="lg" @click="confirmOpen = false">
          Manter minha resposta
        </AppButton>
      </div>
    </BottomSheet>
  </div>
</template>
