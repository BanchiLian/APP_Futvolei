<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';

import AppIcon from '@/components/AppIcon.vue';
import { useNavItems, useStaffNavItems } from '@/components/navItems';
import { currentTab } from '@/router/navigation';

const items = useNavItems();
const staffItems = useStaffNavItems();
const route = useRoute();

/** Highlights the management entry for the screen currently open. */
function isCurrentStaffScreen(name: string): boolean {
  return route.name === name;
}

const LINK =
  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-white';
const ACTIVE = 'bg-aula-600 text-white';
const IDLE = 'text-brand-200 hover:bg-brand-800 hover:text-white';
</script>

<template>
  <!--
    Desktop navigation. Hidden below `lg`, where the bottom bar is used instead.
    Plain links in a list, so Tab/Shift+Tab and Enter work without extra wiring.
  -->
  <aside
    class="bg-brand-900 fixed inset-y-0 left-0 z-20 hidden w-60 flex-col overflow-y-auto px-3 py-5 lg:flex"
  >
    <RouterLink
      :to="{ name: 'home' }"
      class="mb-8 flex min-h-11 items-center gap-3 rounded-lg px-3 text-white"
    >
      <img src="/icon.svg" alt="" class="size-9 rounded-xl" width="36" height="36" />
      <span class="text-lg font-bold tracking-tight">FutCheck</span>
    </RouterLink>

    <nav data-nav="main" aria-label="Navegação principal">
      <ul class="flex flex-col gap-1">
        <li v-for="item in items" :key="item.name">
          <RouterLink v-slot="{ href, navigate }" :to="{ name: item.name }" custom>
            <a
              :href="href"
              :aria-current="currentTab === item.name ? 'page' : undefined"
              :class="[LINK, currentTab === item.name ? ACTIVE : IDLE]"
              @click="navigate"
            >
              <AppIcon :name="item.icon" class="size-5 shrink-0" />
              <span>{{ item.label }}</span>
            </a>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <!--
      The management screens, for whoever runs a CT or the network. Absent for a
      player: each entry is gated on the same permission the route and the API
      check, so the section simply does not render for them.
    -->
    <nav v-if="staffItems.length > 0" data-nav="staff" class="mt-7" aria-label="Gestão">
      <h2 class="text-brand-400 mb-2 px-3 text-xs font-semibold tracking-wide uppercase">Gestão</h2>

      <ul class="flex flex-col gap-1">
        <li v-for="item in staffItems" :key="item.key">
          <RouterLink v-slot="{ href, navigate, route: target }" :to="item.to" custom>
            <a
              :href="href"
              :aria-current="isCurrentStaffScreen(String(target.name)) ? 'page' : undefined"
              :class="[LINK, isCurrentStaffScreen(String(target.name)) ? ACTIVE : IDLE]"
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
