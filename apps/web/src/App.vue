<script setup lang="ts">
import { RouterView } from 'vue-router';

import ToastHost from '@/components/ToastHost.vue';
</script>

<template>
  <RouterView />

  <!-- One host for the whole app; any component can raise a toast. -->
  <ToastHost />
</template>
