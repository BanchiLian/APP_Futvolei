<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="bg-brand-900 flex min-h-dvh flex-col justify-center px-4 py-10">
    <div class="mx-auto w-full max-w-sm">
      <div class="mb-8 flex flex-col items-center gap-3 text-center">
        <img src="/icon.svg" alt="" class="size-16 rounded-2xl" width="64" height="64" />
        <p class="text-brand-300 text-sm">Check-in de aulas e dayuse</p>
      </div>

      <div class="rounded-2xl bg-white p-6 shadow-xl">
        <RouterView />
      </div>
    </div>
  </div>
</template>
