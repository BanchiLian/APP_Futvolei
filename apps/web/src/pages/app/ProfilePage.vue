<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import AppButton from '@/components/AppButton.vue';
import PhaseNotice from '@/components/PhaseNotice.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

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
  <div class="flex flex-col gap-4">
    <PhaseNotice
      phase="Fase 3"
      description="Dados pessoais, troca de foto com recorte, troca de senha e sair. Sem rótulo de perfil de acesso."
    />

    <AppButton
      variant="secondary"
      class="w-full sm:w-auto sm:self-start"
      :loading="isLeaving"
      @click="onLogout"
    >
      Sair
    </AppButton>
  </div>
</template>
