<script setup lang="ts">
import { RouterLink } from 'vue-router';

import { NAV_ITEMS } from '@/components/navItems';
</script>

<template>
  <!--
    Bottom navigation: the primary way around the app on a phone.
    Every target clears 44px and carries a visible label, not just an icon.
    From `lg` up the sidebar takes over.
  -->
  <nav
    class="border-brand-200 fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 backdrop-blur lg:hidden"
    aria-label="Navegação principal"
    :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
  >
    <ul class="mx-auto flex max-w-lg">
      <li v-for="item in NAV_ITEMS" :key="item.name" class="flex-1">
        <RouterLink v-slot="{ href, navigate, isExactActive }" :to="{ name: item.name }" custom>
          <a
            :href="href"
            :aria-current="isExactActive ? 'page' : undefined"
            class="tap-target w-full flex-col gap-1 px-1 py-2 text-xs font-medium"
            :class="isExactActive ? 'text-aula-700' : 'text-brand-500 hover:text-brand-800'"
            @click="navigate"
          >
            <svg
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="item.icon" />
            </svg>
            <span>{{ item.label }}</span>
          </a>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
