<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';

import BottomNav from '@/components/BottomNav.vue';
import SideNav from '@/components/SideNav.vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();

// Only the name: the access profile is never shown to the user (section 4.2).
const userName = computed(() => auth.user?.name ?? '');
const initial = computed(() => userName.value.trim().charAt(0).toUpperCase());
</script>

<template>
  <div class="bg-brand-50 min-h-dvh">
    <SideNav />

    <!-- The sidebar is fixed, so from `lg` up everything else is pushed right of it. -->
    <div class="lg:pl-60">
      <header class="border-brand-200 sticky top-0 z-10 border-b bg-white">
        <div
          class="mx-auto flex h-14 max-w-lg items-center gap-3 px-4 lg:h-16 lg:max-w-5xl lg:px-8"
        >
          <h1 class="text-brand-900 min-w-0 flex-1 truncate text-base font-semibold lg:text-xl">
            {{ route.meta.title ?? 'FutCheck' }}
          </h1>

          <div v-if="userName" class="flex min-w-0 items-center gap-2">
            <span class="text-brand-700 truncate text-sm font-medium">{{ userName }}</span>
            <span
              class="bg-aula-100 text-aula-700 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              aria-hidden="true"
            >
              {{ initial }}
            </span>
          </div>
        </div>
      </header>

      <!-- Bottom padding keeps content clear of the fixed phone navigation. -->
      <main class="mx-auto max-w-lg px-4 pt-4 pb-28 lg:max-w-5xl lg:px-8 lg:pt-8 lg:pb-12">
        <RouterView />
      </main>
    </div>

    <BottomNav />
  </div>
</template>
