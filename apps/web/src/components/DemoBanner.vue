<script setup lang="ts">
import { ref } from 'vue';

import {
  DEMO_ROLES,
  DEMO_ROLE_HINTS,
  DEMO_ROLE_LABELS,
  currentDemoRole,
  setDemoRole,
  type DemoRole,
} from '@/demo/roles';

/**
 * Says plainly that this copy is a demonstration, and lets the visitor switch
 * between the four kinds of user.
 *
 * The switch exists because the panels are the point: an owner and a professor
 * see completely different screens, and a visitor stuck on one account would
 * reasonably conclude the others were never built.
 *
 * Changing role reloads the page rather than patching state in place — the
 * session, the permissions and every cached screen have to start over, and a
 * reload is the one way to be sure none of them survives.
 */
const role = ref<DemoRole>(currentDemoRole());
const dismissed = ref(false);

function change(next: DemoRole): void {
  setDemoRole(next);
  sessionStorage.removeItem('futcheck:demo:session');
  window.location.assign(import.meta.env.BASE_URL);
}
</script>

<template>
  <div class="relative z-50 bg-amber-400 text-amber-950">
    <div class="flex items-start gap-3 px-4 py-2">
      <div class="min-w-0 flex-1">
        <p class="text-xs leading-snug">
          <strong class="font-semibold">Demonstração.</strong>
          Entre com qualquer usuário e senha. Os dados são de exemplo e nada é salvo.
        </p>

        <div v-if="!dismissed" class="mt-2 flex flex-wrap items-center gap-1.5">
          <span class="text-xs font-semibold">Ver como:</span>
          <button
            v-for="option in DEMO_ROLES"
            :key="option"
            type="button"
            class="min-h-8 rounded-lg px-2.5 text-xs font-semibold transition"
            :class="
              role === option
                ? 'bg-amber-950 text-amber-50'
                : 'bg-amber-300 text-amber-950 hover:bg-amber-200'
            "
            :aria-pressed="role === option"
            @click="change(option)"
          >
            {{ DEMO_ROLE_LABELS[option] }}
          </button>
        </div>

        <p v-if="!dismissed" class="mt-1 text-xs opacity-80">
          {{ DEMO_ROLE_LABELS[role] }}: {{ DEMO_ROLE_HINTS[role] }}
        </p>
      </div>

      <button
        type="button"
        class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold underline underline-offset-2"
        @click="dismissed = !dismissed"
      >
        {{ dismissed ? 'Trocar' : 'Ok' }}
      </button>
    </div>
  </div>
</template>
