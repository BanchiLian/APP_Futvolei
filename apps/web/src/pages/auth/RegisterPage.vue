<script setup lang="ts">
import { ref, useId } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useField, useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

import { registerSchema } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import { normalizeApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';

/**
 * Public sign-up.
 *
 * There is deliberately no profile selector, and no text on this screen refers to
 * "aluno" (section 4.2). The server assigns the role; the form has no field for
 * it and the schema would strip one anyway.
 */
const auth = useAuthStore();
const router = useRouter();

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(registerSchema),
});

// The terms checkbox needs its own field: the schema demands literal `true`.
const { value: acceptedTerms, errorMessage: termsError } = useField<boolean>('acceptedTerms');

const termsId = `${useId()}-terms`;
const formError = ref('');

const onSubmit = handleSubmit(async (values) => {
  formError.value = '';

  try {
    await auth.register(values);
    await router.replace({ name: 'home' });
  } catch (error) {
    formError.value = normalizeApiError(error).message;
  }
});
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit="onSubmit">
    <header class="flex flex-col gap-1">
      <h1 class="text-brand-900 text-lg font-semibold">Criar conta</h1>
      <p class="text-brand-500 text-sm">Leva menos de um minuto.</p>
    </header>

    <AppInput name="name" label="Nome completo" autocomplete="name" />
    <AppInput name="email" label="E-mail" type="email" autocomplete="email" />
    <AppInput
      name="phone"
      label="Telefone"
      type="tel"
      autocomplete="tel"
      placeholder="(11) 98888-7777"
    />
    <AppInput
      name="password"
      label="Senha"
      type="password"
      autocomplete="new-password"
      hint="Mínimo de 8 caracteres."
    />

    <div class="flex flex-col gap-1.5">
      <div class="flex items-start gap-3">
        <input
          :id="termsId"
          v-model="acceptedTerms"
          type="checkbox"
          class="border-brand-300 mt-1 size-5 rounded"
          :aria-invalid="termsError ? 'true' : undefined"
        />
        <label :for="termsId" class="text-brand-600 text-sm">
          Li e aceito os termos de uso e a política de privacidade.
        </label>
      </div>

      <p v-if="termsError" role="alert" class="text-danger-600 text-xs font-medium">
        {{ termsError }}
      </p>
    </div>

    <p v-if="formError" role="alert" class="text-danger-600 text-sm font-medium">
      {{ formError }}
    </p>

    <AppButton type="submit" block :loading="isSubmitting">Criar conta</AppButton>

    <p class="text-brand-500 text-center text-sm">
      Já tem conta?
      <RouterLink :to="{ name: 'login' }" class="text-aula-700 font-semibold">Entrar</RouterLink>
    </p>
  </form>
</template>
