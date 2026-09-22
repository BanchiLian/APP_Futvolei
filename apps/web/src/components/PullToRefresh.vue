<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import { tapFeedback } from '@/lib/haptics';

/**
 * Pull-to-refresh built on touch events.
 *
 * The browser's own gesture is switched off globally (`overscroll-behavior-y`),
 * so this is the only refresh a pull triggers. It engages only when the page is
 * scrolled to the very top, which keeps normal scrolling untouched.
 */
const props = defineProps<{ refresh: () => Promise<unknown> }>();

const THRESHOLD_PX = 70;
const MAX_PULL_PX = 110;
const HOLD_PX = 52;

const root = ref<HTMLElement | null>(null);
const pull = ref(0);
const isRefreshing = ref(false);
const isDragging = ref(false);

let startY: number | null = null;
let startX = 0;

const progress = computed(() => Math.min(1, pull.value / THRESHOLD_PX));
const armed = computed(() => pull.value >= THRESHOLD_PX);

function onTouchStart(event: TouchEvent): void {
  if (isRefreshing.value || window.scrollY > 0 || event.touches.length !== 1) {
    startY = null;
    return;
  }
  startY = event.touches[0]?.clientY ?? null;
  startX = event.touches[0]?.clientX ?? 0;
}

function onTouchMove(event: TouchEvent): void {
  if (startY === null) return;
  const touch = event.touches[0];
  if (!touch) return;

  const dy = touch.clientY - startY;
  const dx = Math.abs(touch.clientX - startX);

  // A sideways swipe (day tabs, carousels) is not a pull.
  if (!isDragging.value && (dy <= 0 || dx > dy)) {
    if (dy < 0 || dx > 10) startY = null;
    return;
  }

  isDragging.value = true;
  // Rubber-band resistance, like the native gesture.
  pull.value = Math.min(MAX_PULL_PX, dy * 0.5);
  if (event.cancelable) event.preventDefault();
}

async function onTouchEnd(): Promise<void> {
  if (!isDragging.value) {
    startY = null;
    return;
  }
  isDragging.value = false;
  startY = null;

  if (!armed.value) {
    pull.value = 0;
    return;
  }

  await runRefresh();
}

async function runRefresh(): Promise<void> {
  isRefreshing.value = true;
  pull.value = HOLD_PX;
  tapFeedback(8);
  try {
    await props.refresh();
  } finally {
    isRefreshing.value = false;
    pull.value = 0;
  }
}

onMounted(() => {
  // touchmove must be non-passive so it can stop the page from scrolling mid-pull.
  root.value?.addEventListener('touchstart', onTouchStart, { passive: true });
  root.value?.addEventListener('touchmove', onTouchMove, { passive: false });
  root.value?.addEventListener('touchend', onTouchEnd);
  root.value?.addEventListener('touchcancel', onTouchEnd);
});

onBeforeUnmount(() => {
  root.value?.removeEventListener('touchstart', onTouchStart);
  root.value?.removeEventListener('touchmove', onTouchMove);
  root.value?.removeEventListener('touchend', onTouchEnd);
  root.value?.removeEventListener('touchcancel', onTouchEnd);
});
</script>

<template>
  <div ref="root" class="relative">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
      :style="{ height: `${pull}px` }"
      aria-hidden="true"
    >
      <span
        v-if="pull > 4 || isRefreshing"
        class="text-aula-700 mt-2 flex size-9 items-center justify-center rounded-full bg-white shadow-md"
        :style="{ opacity: isRefreshing ? 1 : progress }"
      >
        <AppIcon
          name="refresh"
          class="size-5"
          :class="isRefreshing ? 'motion-safe:animate-spin' : ''"
          :stroke-width="2.2"
          :style="isRefreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }"
        />
      </span>
    </div>

    <!-- Announced so a screen reader user knows the pull did something. -->
    <p class="sr-only" role="status">{{ isRefreshing ? 'Atualizando…' : '' }}</p>

    <div
      :class="isDragging ? '' : 'transition-transform duration-200 motion-reduce:transition-none'"
      :style="{ transform: pull ? `translateY(${pull}px)` : undefined }"
    >
      <slot />
    </div>
  </div>
</template>
