<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

import { passwordSchema } from '@futcheck/shared';
import { z } from 'zod';

import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import { useToast } from '@/composables/useToast';
import { normalizeApiError } from '@/services/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

/** The token arrives in the link, not from the user, so it is not a form field. */
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));

/**
 * Confirmation is a client-side concern — the API takes a single password — so
 * the form schema extends the shared password rule rather than replacing it.
 */
const formSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'As senhas não conferem',
  });

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(formSchema),
});

const formError = ref('');

const onSubmit = handleSubmit(async (values) => {
  formError.value = '';

  try {
    await auth.resetPassword({ token: token.value, password: values.password });

    toast.success('Senha redefinida. Entre com a nova senha.');
    await router.replace({ name: 'login' });
  } catch (error) {
    formError.value = normalizeApiError(error).message;
  }
});
</script>

<template>
  <div v-if="!token" class="flex flex-col gap-4">
    <h1 class="text-brand-900 text-xl font-semibold sm:text-2xl">Link inválido</h1>
    <p class="text-brand-600 text-sm">
      Este link de redefinição está incompleto. Peça um novo para continuar.
    </p>

    <RouterLink
      :to="{ name: 'forgot-password' }"
      class="tap-target text-aula-700 text-sm font-semibold"
    >
      Pedir novo link
    </RouterLink>
  </div>

  <form v-else class="flex flex-col gap-5" novalidate @submit="onSubmit">
    <header class="flex flex-col gap-1">
      <h1 class="text-brand-900 text-xl font-semibold sm:text-2xl">Criar nova senha</h1>
      <p class="text-brand-500 text-sm">
        Ao concluir, todas as suas sessões ativas serão encerradas.
      </p>
    </header>

    <AppInput
      name="password"
      label="Nova senha"
      type="password"
      autocomplete="new-password"
      hint="Mínimo de 8 caracteres."
    />
    <AppInput
      name="passwordConfirmation"
      label="Confirme a nova senha"
      type="password"
      autocomplete="new-password"
    />

    <p v-if="formError" role="alert" class="text-danger-600 text-sm font-medium">
      {{ formError }}
    </p>

    <AppButton type="submit" block :loading="isSubmitting">Redefinir senha</AppButton>
  </form>
</template>
