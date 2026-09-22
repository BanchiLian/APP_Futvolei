<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';

import { changePasswordSchema } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import { useToast } from '@/composables/useToast';
import { normalizeApiError } from '@/services/http';
import { changePassword } from '@/services/me';

/**
 * Its own component on purpose.
 *
 * `useForm` provides the form context to the whole subtree, so two calls in one
 * component make the second one win — which silently bound the profile inputs to
 * the password form and left them empty. One form per component.
 */
const emit = defineEmits<{ done: [] }>();

const toast = useToast();

const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(changePasswordSchema),
});

const onSubmit = handleSubmit(async (values) => {
  try {
    await changePassword(values);
    resetForm();
    toast.success('Senha alterada. As outras sessões foram encerradas.');
    emit('done');
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  }
});
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit="onSubmit">
    <AppInput
      name="currentPassword"
      label="Senha atual"
      type="password"
      autocomplete="current-password"
    />
    <AppInput
      name="newPassword"
      label="Nova senha"
      type="password"
      autocomplete="new-password"
      hint="Mínimo de 8 caracteres."
    />
    <AppButton type="submit" block :loading="isSubmitting">Salvar nova senha</AppButton>
  </form>
</template>
