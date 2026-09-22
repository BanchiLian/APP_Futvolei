<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

import { loginSchema } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import { normalizeApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

// The same schema the API validates against, so the rules cannot drift apart.
const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(loginSchema),
});

const formError = ref('');

const onSubmit = handleSubmit(async (values) => {
  formError.value = '';

  try {
    await auth.login(values);

    // Honour where the guard sent the user from, but only as an in-app path —
    // an absolute URL here would be an open redirect.
    const redirect = route.query.redirect;
    const target = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : null;

    await router.replace(target ?? { name: 'home' });
  } catch (error) {
    formError.value = normalizeApiError(error).message;
  }
});
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit="onSubmit">
    <header class="flex flex-col gap-1">
      <h1 class="text-brand-900 text-lg font-semibold">Entrar</h1>
      <p class="text-brand-500 text-sm">Use o e-mail e a senha da sua conta.</p>
    </header>

    <AppInput name="email" label="E-mail" type="email" autocomplete="email" />
    <AppInput name="password" label="Senha" type="password" autocomplete="current-password" />

    <p v-if="formError" role="alert" class="text-danger-600 text-sm font-medium">
      {{ formError }}
    </p>

    <AppButton type="submit" block :loading="isSubmitting">Entrar</AppButton>

    <div class="flex flex-col items-center gap-2 text-sm">
      <RouterLink :to="{ name: 'forgot-password' }" class="tap-target text-aula-700">
        Esqueci minha senha
      </RouterLink>

      <p class="text-brand-500">
        Ainda não tem conta?
        <RouterLink :to="{ name: 'register' }" class="text-aula-700 font-semibold">
          Criar conta
        </RouterLink>
      </p>
    </div>
  </form>
</template>
