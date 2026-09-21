<script setup lang="ts">
import { RouterLink } from 'vue-router';

interface NavItem {
  name: string;
  label: string;
  /** Inline SVG path data, so the app needs no icon dependency. */
  icon: string;
}

const items: NavItem[] = [
  { name: 'home', label: 'Início', icon: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10' },
  { name: 'agenda', label: 'Agenda', icon: 'M4 7h16v13H4zM4 7V5h16v2M8 3v4M16 3v4M8 12h8M8 16h5' },
  { name: 'my-sessions', label: 'Minhas', icon: 'M5 12l4.5 4.5L19 7M5 19h14' },
  {
    name: 'profile',
    label: 'Perfil',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  },
];
</script>

<template>
  <!--
    Bottom navigation: the primary way around the app on a phone.
    Every target clears 44px and carries a visible label, not just an icon.
  -->
  <nav
    class="border-brand-200 fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 backdrop-blur"
    aria-label="Navegação principal"
    :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
  >
    <ul class="mx-auto flex max-w-lg">
      <li v-for="item in items" :key="item.name" class="flex-1">
        <RouterLink
          v-slot="{ isExactActive }"
          :to="{ name: item.name }"
          class="tap-target w-full flex-col gap-1 px-1 py-2 text-xs font-medium"
          :aria-label="item.label"
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
          <span :class="isExactActive ? 'text-aula-700' : 'text-brand-500'">{{ item.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/* `router-link-exact-active` is what vue-router adds to the current entry. */
a.router-link-exact-active {
  color: var(--color-aula-700);
}
</style>
