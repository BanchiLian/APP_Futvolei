<script setup lang="ts">
import { ICONS, type IconName } from '@/components/icons';

withDefaults(defineProps<{ name: IconName; strokeWidth?: number }>(), { strokeWidth: 1.8 });
</script>

<template>
  <!-- Decorative by default: the surrounding control always carries the text. -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="ICONS[name]" />
  </svg>
</template>
