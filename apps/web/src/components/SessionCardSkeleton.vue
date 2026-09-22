<script setup lang="ts">
import SkeletonBlock from '@/components/SkeletonBlock.vue';
</script>

<template>
  <div class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
    <SkeletonBlock class="h-5 w-20 rounded-full" />
    <SkeletonBlock class="h-6 w-32" />
    <SkeletonBlock class="h-4 w-44" />
  </div>
</template>
