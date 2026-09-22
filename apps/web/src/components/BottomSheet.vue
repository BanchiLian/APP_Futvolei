<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

/**
 * Modal sheet that rises from the bottom edge, the phone-native way to confirm an
 * action or pick a filter. Closes on backdrop tap, Escape, or dragging the handle
 * down; keeps focus inside while open and hands it back afterwards.
 */
defineProps<{ title: string; description?: string }>();
const open = defineModel<boolean>('open', { required: true });

const uid = useId();
const titleId = `${uid}-title`;
const descriptionId = `${uid}-desc`;

const panel = ref<HTMLElement | null>(null);
const dragOffset = ref(0);
let dragStartY: number | null = null;
let returnFocusTo: HTMLElement | null = null;

const DISMISS_DRAG_PX = 90;

function close(): void {
  open.value = false;
}

function focusables(): HTMLElement[] {
  if (!panel.value) return [];
  return [
    ...panel.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== 'Tab') return;

  const items = focusables();
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onDragStart(event: TouchEvent): void {
  dragStartY = event.touches[0]?.clientY ?? null;
}

function onDragMove(event: TouchEvent): void {
  if (dragStartY === null) return;
  const y = event.touches[0]?.clientY ?? dragStartY;
  dragOffset.value = Math.max(0, y - dragStartY);
}

function onDragEnd(): void {
  if (dragOffset.value > DISMISS_DRAG_PX) close();
  dragOffset.value = 0;
  dragStartY = null;
}

function lockScroll(locked: boolean): void {
  // Stops the page behind from scrolling (and pull-to-refreshing) under the sheet.
  document.documentElement.style.overflow = locked ? 'hidden' : '';
}

watch(open, async (isOpen) => {
  lockScroll(isOpen);
  if (isOpen) {
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    (focusables()[0] ?? panel.value)?.focus();
  } else {
    returnFocusTo?.focus();
    returnFocusTo = null;
  }
});

onBeforeUnmount(() => {
  if (open.value) lockScroll(false);
});

defineExpose({ close });
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 motion-reduce:duration-0"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150 motion-reduce:duration-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="bg-brand-900/50 fixed inset-0 z-40"
        aria-hidden="true"
        @click="close"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-250 ease-out motion-reduce:duration-0"
      enter-from-class="translate-y-full"
      leave-active-class="transition-transform duration-200 ease-in motion-reduce:duration-0"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="description ? descriptionId : undefined"
        tabindex="-1"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pt-2 shadow-2xl outline-none lg:bottom-6 lg:rounded-3xl"
        :style="{
          transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }"
        @keydown="onKeydown"
      >
        <!-- The handle is the drag target; a larger invisible area makes it easy to grab. -->
        <div
          class="flex h-6 cursor-grab touch-none items-center justify-center"
          aria-hidden="true"
          @touchstart.passive="onDragStart"
          @touchmove.passive="onDragMove"
          @touchend="onDragEnd"
          @touchcancel="onDragEnd"
        >
          <span class="bg-brand-200 h-1.5 w-10 rounded-full" />
        </div>

        <header class="mb-4 flex items-start gap-3">
          <div class="min-w-0 flex-1 pt-1">
            <h2 :id="titleId" class="text-brand-900 text-lg font-semibold">{{ title }}</h2>
            <p v-if="description" :id="descriptionId" class="text-brand-500 mt-1 text-sm">
              {{ description }}
            </p>
          </div>
          <button
            type="button"
            class="tap-target press text-brand-500 -mr-2 rounded-full"
            aria-label="Fechar"
            @click="close"
          >
            <svg
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <slot />
      </div>
    </Transition>
  </Teleport>
</template>
