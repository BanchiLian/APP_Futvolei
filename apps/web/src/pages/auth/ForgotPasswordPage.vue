<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

import { forgotPasswordSchema } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import { normalizeApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(forgotPasswordSchema),
});

/**
 * Once submitted, the screen shows the same confirmation whether or not the
 * account exists. Saying "we could not find that e-mail" would turn this form
 * into a way to discover who has an account.
 */
const sentMessage = ref('');
const formError = ref('');

const onSubmit = handleSubmit(async (values) => {
  formError.value = '';

  try {
    sentMessage.value = await auth.forgotPassword(values.email);
  } catch (error) {
    formError.value = normalizeApiError(error).message;
  }
});
</script>

<template>
  <div v-if="sentMessage" class="flex flex-col gap-4">
    <h1 class="text-brand-900 text-lg font-semibold">Verifique seu e-mail</h1>
    <p role="status" class="text-brand-600 text-sm">{{ sentMessage }}</p>

    <RouterLink :to="{ name: 'login' }" class="tap-target text-aula-700 text-sm font-semibold">
      Voltar para o login
    </RouterLink>
  </div>

  <form v-else class="flex flex-col gap-5" novalidate @submit="onSubmit">
    <header class="flex flex-col gap-1">
      <h1 class="text-brand-900 text-lg font-semibold">Esqueci minha senha</h1>
      <p class="text-brand-500 text-sm">
        Informe seu e-mail e enviaremos um link para criar uma nova senha.
      </p>
    </header>

    <AppInput name="email" label="E-mail" type="email" autocomplete="email" />

    <p v-if="formError" role="alert" class="text-danger-600 text-sm font-medium">
      {{ formError }}
    </p>

    <AppButton type="submit" block :loading="isSubmitting">Enviar link</AppButton>

    <RouterLink
      :to="{ name: 'login' }"
      class="tap-target text-aula-700 text-center text-sm font-semibold"
    >
      Voltar para o login
    </RouterLink>
  </form>
</template>
