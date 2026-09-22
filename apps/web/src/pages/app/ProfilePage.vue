<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useField, useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

import { updateProfileSchema, type SkillLevel } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import AppInput from '@/components/AppInput.vue';
import BottomSheet from '@/components/BottomSheet.vue';
import ChangePasswordForm from '@/components/ChangePasswordForm.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import SessionCard from '@/components/SessionCard.vue';
import SessionCardSkeleton from '@/components/SessionCardSkeleton.vue';
import ToggleSwitch from '@/components/ToggleSwitch.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useResource } from '@/composables/useResource';
import { useToast } from '@/composables/useToast';
import { SKILL_LEVEL_OPTIONS } from '@/lib/skillLevel';
import { normalizeApiError } from '@/services/http';
import { listMyBookings, updateMe, type BookingPeriod } from '@/services/me';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const user = computed(() => auth.user);

// -----------------------------------------------------------------------------
// Personal data
// -----------------------------------------------------------------------------

/**
 * The form starts from the session the guard already loaded, rather than being
 * filled after mount — that depended on when each input registered itself, and
 * left the fields blank.
 */
function profileValues() {
  return {
    name: user.value?.name ?? '',
    phone: user.value?.phone ?? '',
    birthDate: user.value?.birthDate ?? undefined,
    skillLevel: user.value?.skillLevel ?? undefined,
  };
}

const { handleSubmit, isSubmitting, setFieldValue } = useForm({
  validationSchema: toTypedSchema(updateProfileSchema),
});

/**
 * Fields are filled one by one rather than through `initialValues`.
 *
 * The schema carries transforms (the phone is reduced to digits), and
 * VeeValidate runs initial values through it — which dropped them before they
 * ever reached the inputs. Setting each field explicitly is unambiguous.
 */
function fillForm(): void {
  const current = profileValues();
  setFieldValue('name', current.name);
  setFieldValue('phone', current.phone);
  setFieldValue('birthDate', current.birthDate);
  setFieldValue('skillLevel', current.skillLevel);
}

onMounted(fillForm);
// A different account, or a reload that refreshed the profile, refills the form.
watch(() => user.value?.id, fillForm);

// The level is a radio group, so it needs its own field binding.
const { value: skillLevelModel } = useField<SkillLevel | undefined>('skillLevel');

const onSaveProfile = handleSubmit(async (values) => {
  try {
    const updated = await updateMe(values);
    if (auth.accessToken) auth.setSession(auth.accessToken, updated);
    toast.success('Perfil atualizado.');
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  }
});

// -----------------------------------------------------------------------------
// Community visibility — saved on toggle, no separate button
// -----------------------------------------------------------------------------

const showInCommunity = ref(user.value?.showInCommunity ?? true);
watch(
  () => user.value?.showInCommunity,
  (value) => {
    if (value !== undefined) showInCommunity.value = value;
  },
);

let savingVisibility = false;

watch(showInCommunity, async (value) => {
  if (savingVisibility || value === user.value?.showInCommunity) return;
  savingVisibility = true;

  try {
    const updated = await updateMe({ showInCommunity: value });
    if (auth.accessToken) auth.setSession(auth.accessToken, updated);
  } catch (error) {
    // Put the switch back where it was: it must reflect what the server stored.
    showInCommunity.value = user.value?.showInCommunity ?? true;
    toast.error(normalizeApiError(error).message);
  } finally {
    savingVisibility = false;
  }
});

// -----------------------------------------------------------------------------
// Password
// -----------------------------------------------------------------------------

const passwordSheetOpen = ref(false);

// -----------------------------------------------------------------------------
// My sessions
// -----------------------------------------------------------------------------

const period = ref<BookingPeriod>('upcoming');
const bookings = useResource(() => listMyBookings(period.value));

onMounted(bookings.load);
watch(period, bookings.load);

// -----------------------------------------------------------------------------

const isLeaving = ref(false);

async function onLogout(): Promise<void> {
  isLeaving.value = true;

  try {
    // `logout` always clears the local session, even when the server call fails.
    await auth.logout();
  } finally {
    await router.replace({ name: 'login' });
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex items-center gap-4">
      <UserAvatar :name="user?.name ?? ''" :src="user?.avatarThumbnailUrl ?? null" size="xl" />
      <div class="min-w-0">
        <h2 class="text-brand-900 truncate text-lg font-semibold">{{ user?.name }}</h2>
        <p class="text-brand-500 truncate text-sm">{{ user?.email }}</p>
      </div>
    </header>

    <section class="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h3 class="text-brand-900 text-sm font-semibold">Seus dados</h3>

      <form class="flex flex-col gap-4" novalidate @submit="onSaveProfile">
        <AppInput name="name" label="Nome completo" autocomplete="name" />
        <AppInput name="phone" label="Telefone" type="tel" autocomplete="tel" />
        <AppInput name="birthDate" label="Data de nascimento" type="date" />

        <fieldset class="flex flex-col gap-2">
          <legend class="text-brand-700 text-sm font-medium">Nível de jogo</legend>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="option in SKILL_LEVEL_OPTIONS"
              :key="option.value"
              class="tap-target press border-brand-200 has-checked:border-aula-600 has-checked:bg-aula-50 has-checked:text-aula-700 text-brand-600 cursor-pointer rounded-xl border px-4 text-sm font-medium"
            >
              <input
                v-model="skillLevelModel"
                type="radio"
                name="skillLevel"
                :value="option.value"
                class="sr-only"
              />
              {{ option.label }}
            </label>
          </div>
        </fieldset>

        <AppButton type="submit" :loading="isSubmitting">Salvar alterações</AppButton>
      </form>
    </section>

    <section class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h3 class="text-brand-900 text-sm font-semibold">Privacidade</h3>
      <ToggleSwitch
        v-model="showInCommunity"
        label="Aparecer na comunidade"
        description="Outras pessoas veem seu nome, foto e nível. Nunca seu e-mail ou telefone."
      />
    </section>

    <section id="minhas-sessoes" class="flex flex-col gap-3">
      <h3 class="text-brand-900 px-1 text-sm font-semibold">Minhas sessões</h3>

      <SegmentedControl
        v-model="period"
        :options="[
          { value: 'upcoming', label: 'Próximas' },
          { value: 'past', label: 'Histórico' },
        ]"
        label="Período das minhas sessões"
      />

      <SessionCardSkeleton v-if="bookings.isInitialLoading.value" />

      <ErrorState
        v-else-if="bookings.error.value"
        :message="bookings.error.value"
        :retrying="bookings.isFetching.value"
        @retry="bookings.load"
      />

      <EmptyState
        v-else-if="(bookings.data.value ?? []).length === 0"
        icon="history"
        :title="period === 'upcoming' ? 'Nada marcado' : 'Nenhuma sessão ainda'"
        :description="
          period === 'upcoming'
            ? 'Suas próximas confirmações aparecem aqui.'
            : 'Depois de jogar, seu histórico aparece aqui.'
        "
      />

      <SessionCard
        v-for="session in bookings.data.value ?? []"
        :key="session.id"
        :session="session"
        show-date
      />
    </section>

    <section class="flex flex-col gap-2">
      <AppButton variant="secondary" block @click="passwordSheetOpen = true">
        <AppIcon name="lock" class="size-5" />
        Trocar senha
      </AppButton>

      <AppButton variant="ghost" block :loading="isLeaving" @click="onLogout">
        <AppIcon name="logout" class="size-5" />
        Sair
      </AppButton>
    </section>

    <BottomSheet
      v-model:open="passwordSheetOpen"
      title="Trocar senha"
      description="Ao concluir, suas outras sessões serão encerradas."
    >
      <ChangePasswordForm @done="passwordSheetOpen = false" />
    </BottomSheet>
  </div>
</template>
