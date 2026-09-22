<script setup lang="ts">
import { computed } from 'vue';

import type { SessionType } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import { SESSION_TYPE_META } from '@/lib/sessionType';

const props = defineProps<{ type: SessionType }>();
const meta = computed(() => SESSION_TYPE_META[props.type]);
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
    :class="meta.badge"
  >
    <AppIcon :name="meta.icon" class="size-3.5" :stroke-width="2.2" />
    {{ meta.label }}
  </span>
</template>
