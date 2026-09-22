<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import AppIcon from '@/components/AppIcon.vue';
import { useNavItems } from '@/components/navItems';
import { currentTab } from '@/router/navigation';

const items = useNavItems();
const route = useRoute();

const activeIndex = computed(() => items.value.findIndex((item) => item.name === currentTab.value));
// A pushed screen (session, CT) keeps its tab lit, like a native navigation stack.
const isAtTabRoot = computed(() => (route.meta.depth ?? 0) === 0);
</script>

<template>
  <!--
    Bottom tab bar: the primary way around the app on a phone. Every target clears
    44px and carries a visible label. From `lg` up the sidebar takes over.
  -->
  <nav
    class="border-brand-200 fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur-md lg:hidden"
    aria-label="Navegação principal"
    :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
  >
    <ul class="relative mx-auto flex max-w-lg">
      <!-- One pill slides between tabs instead of each tab lighting up on its own. -->
      <li
        v-if="activeIndex >= 0"
        class="pointer-events-none absolute top-1.5 left-0 flex h-8 justify-center transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
        :style="{
          width: `${100 / items.length}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        }"
        aria-hidden="true"
      >
        <span class="bg-aula-100 h-8 w-16 rounded-full" />
      </li>

      <li v-for="item in items" :key="item.name" class="relative flex-1">
        <RouterLink v-slot="{ href, navigate }" :to="{ name: item.name }" custom>
          <a
            :href="href"
            :aria-current="currentTab === item.name && isAtTabRoot ? 'page' : undefined"
            class="press flex min-h-14 w-full flex-col items-center justify-start gap-1 px-1 pt-2 pb-1.5 text-[11px] font-semibold"
            :class="currentTab === item.name ? 'text-aula-700' : 'text-brand-500'"
            @click="navigate"
          >
            <AppIcon
              :name="item.icon"
              class="size-6 transition-transform duration-200 motion-reduce:transition-none"
              :class="currentTab === item.name ? 'scale-110' : ''"
              :stroke-width="currentTab === item.name ? 2.2 : 1.8"
            />
            <span>{{ item.label }}</span>
          </a>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
