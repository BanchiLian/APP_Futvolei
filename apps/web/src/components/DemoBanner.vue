<script setup lang="ts">
import { ref } from 'vue';

/**
 * Says plainly that this copy is a demonstration.
 *
 * The published build has no server behind it: the data is a snapshot and
 * anything the visitor changes lives only in their own tab. Saying so matters,
 * because every screen otherwise behaves exactly like the real product and a
 * visitor would reasonably assume their answer had been recorded somewhere.
 */
const dismissed = ref(false);
</script>

<template>
  <div
    v-if="!dismissed"
    class="fixed inset-x-0 top-0 z-50 flex items-center gap-3 bg-amber-400 px-4 py-2 text-amber-950"
    role="status"
  >
    <p class="min-w-0 flex-1 text-xs leading-snug">
      <strong class="font-semibold">Demonstração.</strong>
      Entre com qualquer usuário e senha. Os dados são de exemplo e nada é salvo.
    </p>

    <button
      type="button"
      class="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold underline underline-offset-2"
      @click="dismissed = true"
    >
      Ok
    </button>
  </div>
</template>
