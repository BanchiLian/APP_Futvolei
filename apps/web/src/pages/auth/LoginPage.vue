<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="flex flex-col gap-4">
    <h2 class="text-brand-900 text-lg font-semibold">Entrar</h2>

    <p class="text-brand-500 text-sm">
      O login, o cadastro e a recuperação de senha chegam na Fase 2, junto com o RBAC e os guards de
      rota.
    </p>

    <RouterLink
      :to="{ name: 'status' }"
      class="tap-target bg-brand-900 rounded-lg px-4 text-sm font-semibold text-white"
    >
      Voltar ao status
    </RouterLink>
  </div>
</template>
