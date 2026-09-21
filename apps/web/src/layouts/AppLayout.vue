<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';

import BottomNav from '@/components/BottomNav.vue';

const route = useRoute();
</script>

<template>
  <div class="bg-brand-50 min-h-dvh">
    <header class="border-brand-200 sticky top-0 z-10 border-b bg-white">
      <div class="mx-auto flex h-14 max-w-lg items-center px-4">
        <h1 class="text-brand-900 text-base font-semibold">
          {{ route.meta.title ?? 'FutCheck' }}
        </h1>
      </div>
    </header>

    <!-- Bottom padding keeps content clear of the fixed navigation. -->
    <main class="mx-auto max-w-lg px-4 pt-4 pb-28">
      <RouterView />
    </main>

    <BottomNav />
  </div>
</template>
