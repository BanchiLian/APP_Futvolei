<script setup lang="ts">
import { RouterView } from 'vue-router';

import DemoBanner from '@/components/DemoBanner.vue';
import ToastHost from '@/components/ToastHost.vue';

const isDemo = import.meta.env.VITE_DEMO === 'true';
</script>

<template>
  <DemoBanner v-if="isDemo" />

  <RouterView />

  <!-- One host for the whole app; any component can raise a toast. -->
  <ToastHost />
</template>
