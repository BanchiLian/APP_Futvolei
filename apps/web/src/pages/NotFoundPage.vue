<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <!-- Same dark shell as the auth screens, so a wrong link still feels like the app. -->
  <main class="bg-brand-900 flex min-h-dvh flex-col justify-center px-4 py-8">
    <div class="mx-auto flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <div class="flex flex-col items-center gap-3">
        <img src="/icon.svg" alt="" class="size-14 rounded-2xl" width="64" height="64" />
        <p class="text-2xl font-bold tracking-tight text-white">FutCheck</p>
      </div>

      <div class="flex w-full flex-col items-center gap-3 rounded-2xl bg-white p-6 shadow-xl">
        <p class="text-aula-600 text-6xl font-bold tracking-tight" aria-hidden="true">404</p>
        <h1 class="text-brand-900 text-xl font-semibold sm:text-2xl">Página não encontrada</h1>
        <p class="text-brand-500 text-sm">O endereço que você abriu não existe ou foi movido.</p>

        <RouterLink
          :to="{ name: 'home' }"
          class="tap-target bg-aula-600 hover:bg-aula-700 mt-2 w-full rounded-lg px-4 text-sm font-semibold text-white"
        >
          Voltar ao início
        </RouterLink>
      </div>
    </div>
  </main>
</template>
