<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';

import AppIcon from '@/components/AppIcon.vue';
import BottomNav from '@/components/BottomNav.vue';
import SideNav from '@/components/SideNav.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { currentTab, notifyPageEnter, pageTitle } from '@/router/navigation';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

// Only the name: the access profile is never shown to the user (section 4.2).
const userName = computed(() => auth.user?.name ?? '');
const avatar = computed(() => auth.user?.avatarThumbnailUrl ?? auth.user?.avatarUrl ?? null);

const isPushed = computed(() => (route.meta.depth ?? 0) > 0);
const title = computed(() => pageTitle.value ?? route.meta.title ?? 'FutCheck');

/**
 * Tab roots are kept alive so switching tabs keeps their data and state. Pushed
 * screens are not: each one shows a different record and should load fresh.
 */
const KEEP_ALIVE = ['HomePage', 'AgendaPage', 'VenuesPage', 'CommunityPage', 'ProfilePage'];

function goBack(): void {
  // Opened from a shared link there is no history to go back to — land on the tab.
  if (window.history.state?.back) {
    router.back();
  } else {
    void router.replace({ name: currentTab.value });
  }
}
</script>

<template>
  <div class="bg-brand-50 min-h-dvh">
    <SideNav />

    <!-- The sidebar is fixed, so from `lg` up everything else is pushed right of it. -->
    <div class="lg:pl-60">
      <header
        class="border-brand-200/80 sticky top-0 z-20 border-b bg-white/90 backdrop-blur-md"
        :style="{ paddingTop: 'env(safe-area-inset-top)' }"
      >
        <div
          class="mx-auto flex h-14 max-w-lg items-center gap-2 px-2 lg:h-16 lg:max-w-5xl lg:px-8"
        >
          <button
            v-if="isPushed"
            type="button"
            class="tap-target press text-aula-700 -ml-1 rounded-full"
            aria-label="Voltar"
            @click="goBack"
          >
            <AppIcon name="chevron-left" class="size-6" :stroke-width="2.2" />
          </button>
          <span v-else class="w-2" aria-hidden="true" />

          <h1 class="text-brand-900 min-w-0 flex-1 truncate text-lg font-bold lg:text-xl">
            {{ title }}
          </h1>

          <RouterLink
            v-if="userName && !isPushed"
            :to="{ name: 'profile' }"
            class="tap-target press rounded-full lg:hidden"
            aria-label="Abrir perfil"
          >
            <UserAvatar :name="userName" :src="avatar" size="sm" />
          </RouterLink>
          <div v-if="userName" class="hidden min-w-0 items-center gap-2 lg:flex">
            <span class="text-brand-700 truncate text-sm font-medium">{{ userName }}</span>
            <UserAvatar :name="userName" :src="avatar" size="sm" />
          </div>
        </div>
      </header>

      <!-- Bottom padding keeps content clear of the fixed tab bar and the home indicator. -->
      <main
        class="mx-auto max-w-lg overflow-x-clip px-4 pt-4 lg:max-w-5xl lg:px-8 lg:pt-8 lg:pb-12"
        :style="{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }"
      >
        <RouterView v-slot="{ Component, route: viewRoute }">
          <Transition
            :name="viewRoute.meta.transition ?? 'tab'"
            mode="out-in"
            @enter="notifyPageEnter"
          >
            <KeepAlive :include="KEEP_ALIVE">
              <component
                :is="Component"
                :key="
                  (viewRoute.meta.depth ?? 0) === 0 ? String(viewRoute.name) : viewRoute.fullPath
                "
              />
            </KeepAlive>
          </Transition>
        </RouterView>
      </main>
    </div>

    <BottomNav />
  </div>
</template>
