<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <main
    class="bg-brand-50 flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
  >
    <p class="text-brand-300 text-5xl font-bold">404</p>
    <h1 class="text-brand-900 text-lg font-semibold">Página não encontrada</h1>
    <p class="text-brand-500 max-w-sm text-sm">
      O endereço que você abriu não existe ou foi movido.
    </p>

    <RouterLink
      :to="{ name: 'home' }"
      class="tap-target bg-brand-900 rounded-lg px-4 text-sm font-semibold text-white"
    >
      Voltar ao início
    </RouterLink>
  </main>
</template>
