<script setup lang="ts">
import { RouterLink } from 'vue-router';

import AppIcon from '@/components/AppIcon.vue';
import { useNavItems } from '@/components/navItems';
import { currentTab } from '@/router/navigation';

const items = useNavItems();
</script>

<template>
  <!--
    Desktop navigation. Hidden below `lg`, where the bottom bar is used instead.
    Plain links in a list, so Tab/Shift+Tab and Enter work without extra wiring.
  -->
  <aside class="bg-brand-900 fixed inset-y-0 left-0 z-20 hidden w-60 flex-col px-3 py-5 lg:flex">
    <RouterLink
      :to="{ name: 'home' }"
      class="mb-8 flex min-h-11 items-center gap-3 rounded-lg px-3 text-white"
    >
      <img src="/icon.svg" alt="" class="size-9 rounded-xl" width="36" height="36" />
      <span class="text-lg font-bold tracking-tight">FutCheck</span>
    </RouterLink>

    <nav aria-label="Navegação principal">
      <ul class="flex flex-col gap-1">
        <li v-for="item in items" :key="item.name">
          <RouterLink v-slot="{ href, navigate }" :to="{ name: item.name }" custom>
            <a
              :href="href"
              :aria-current="currentTab === item.name ? 'page' : undefined"
              class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-white"
              :class="
                currentTab === item.name
                  ? 'bg-aula-600 text-white'
                  : 'text-brand-200 hover:bg-brand-800 hover:text-white'
              "
              @click="navigate"
            >
              <AppIcon :name="item.icon" class="size-5 shrink-0" />
              <span>{{ item.label }}</span>
            </a>
          </RouterLink>
        </li>
      </ul>
    </nav>
  </aside>
</template>
