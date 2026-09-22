<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <!--
    Phone: brand stacked above the card. From `lg` up the brand moves into its own
    column, so a wide screen reads as a composed page instead of a phone card
    floating in empty space. Vertical padding shrinks there so the sign-up form
    fits a 768px-tall laptop screen without scrolling.
  -->
  <div class="bg-brand-900 flex min-h-dvh flex-col justify-center px-4 py-8 lg:px-10 lg:py-6">
    <div
      class="mx-auto flex w-full max-w-sm flex-col lg:max-w-5xl lg:flex-row lg:items-center lg:justify-between lg:gap-16"
    >
      <div
        class="mb-6 flex flex-col items-center gap-3 text-center lg:mb-0 lg:max-w-md lg:items-start lg:gap-5 lg:text-left"
      >
        <img src="/icon.svg" alt="" class="size-14 rounded-2xl lg:size-16" width="64" height="64" />
        <p class="text-2xl font-bold tracking-tight text-white lg:text-5xl">FutCheck</p>
        <p class="text-brand-300 text-sm lg:hidden">Check-in de aulas e dayuse</p>
        <p class="text-brand-200 hidden text-xl leading-relaxed lg:block">
          Confirme presença nas aulas e no dayuse em um toque.
        </p>
        <ul class="hidden gap-3 lg:flex" aria-label="Tipos de sessão">
          <li class="bg-aula-600 rounded-full px-3 py-1 text-sm font-medium text-white">Aulas</li>
          <li class="bg-dayuse-500 text-brand-900 rounded-full px-3 py-1 text-sm font-medium">
            Dayuse
          </li>
        </ul>
      </div>

      <div class="w-full rounded-2xl bg-white p-6 shadow-xl lg:max-w-md lg:shrink-0">
        <RouterView />
      </div>
    </div>
  </div>
</template>
