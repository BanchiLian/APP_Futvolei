<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';

import type { PostDto } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useToast } from '@/composables/useToast';
import { formatRelativeMoment } from '@/lib/format';
import { tapFeedback } from '@/lib/haptics';
import { normalizeApiError } from '@/services/http';
import { deletePost, likePost, unlikePost } from '@/services/feed';

const props = defineProps<{ post: PostDto }>();
const emit = defineEmits<{ update: [post: PostDto]; removed: [id: string] }>();

const toast = useToast();

const isLiking = ref(false);
const isRemoving = ref(false);
const confirmingRemoval = ref(false);
/** Shows the big heart for a moment after a double tap. */
const burst = ref(false);

/**
 * Reserving the exact aspect ratio keeps the feed from jumping while photos
 * load — the thing that most makes a web page feel unlike an app.
 */
const aspectRatio = computed(() => `${props.post.width} / ${props.post.height}`);

const likeLabel = computed(() =>
  props.post.likeCount === 1 ? '1 curtida' : `${props.post.likeCount} curtidas`,
);

async function setLiked(liked: boolean): Promise<void> {
  if (isLiking.value || liked === props.post.likedByMe) return;
  isLiking.value = true;
  tapFeedback();

  try {
    // The server returns the post, so the count on screen is its count, not ours.
    emit('update', liked ? await likePost(props.post.id) : await unlikePost(props.post.id));
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isLiking.value = false;
  }
}

/**
 * Double tap on the photo likes it, the way every photo feed works. It only ever
 * likes: undoing by accident on a second double tap would be a surprise.
 */
let lastTap = 0;

function onPhotoTap(): void {
  const now = Date.now();
  const isDoubleTap = now - lastTap < 300;
  lastTap = isDoubleTap ? 0 : now;

  if (!isDoubleTap) return;

  burst.value = true;
  window.setTimeout(() => (burst.value = false), 700);
  void setLiked(true);
}

async function remove(): Promise<void> {
  isRemoving.value = true;

  try {
    await deletePost(props.post.id);
    emit('removed', props.post.id);
    toast.success('Publicação apagada.');
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isRemoving.value = false;
    confirmingRemoval.value = false;
  }
}
</script>

<template>
  <article class="bg-white sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-black/5">
    <header class="flex items-center gap-3 px-4 py-3">
      <UserAvatar :name="post.author.name" :src="post.author.avatarUrl" size="sm" />

      <div class="min-w-0 flex-1 leading-tight">
        <p class="text-brand-900 truncate text-sm font-semibold">{{ post.author.name }}</p>
        <RouterLink
          v-if="post.venue"
          :to="{ name: 'venue-detail', params: { id: post.venue.id } }"
          class="text-brand-500 -my-2.5 flex min-h-11 items-center gap-1 text-xs"
        >
          <AppIcon name="pin" class="size-3.5" />
          <span class="truncate">{{ post.venue.name }}</span>
        </RouterLink>
      </div>

      <button
        v-if="post.canDelete && !confirmingRemoval"
        type="button"
        class="tap-target press text-brand-400 rounded-full"
        aria-label="Apagar publicação"
        @click="confirmingRemoval = true"
      >
        <AppIcon name="x" class="size-5" />
      </button>
    </header>

    <div
      v-if="confirmingRemoval"
      class="bg-danger-50 flex items-center justify-between gap-3 px-4 pb-3"
    >
      <p class="text-danger-700 text-xs">Apagar esta publicação?</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="tap-target press text-brand-600 rounded-lg px-3 text-xs font-semibold"
          @click="confirmingRemoval = false"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="tap-target press bg-danger-600 rounded-lg px-3 text-xs font-semibold text-white"
          :disabled="isRemoving"
          @click="remove"
        >
          Apagar
        </button>
      </div>
    </div>

    <!-- The photo fills the width, as in any photo feed. Tapping is a gesture,
         not a control, so the keyboard path is the like button below. -->
    <div
      class="bg-brand-100 relative overflow-hidden select-none"
      :style="{ aspectRatio }"
      @click="onPhotoTap"
    >
      <img
        :src="post.imageUrl"
        :alt="post.caption ?? `Foto publicada por ${post.author.name}`"
        class="size-full object-cover"
        loading="lazy"
        decoding="async"
      />

      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-50 opacity-0"
        leave-active-class="transition duration-500 ease-in"
        leave-to-class="scale-125 opacity-0"
      >
        <div v-if="burst" class="pointer-events-none absolute inset-0 grid place-items-center">
          <AppIcon name="heart" class="size-24 text-white/90 drop-shadow-lg" :stroke-width="1.5" />
        </div>
      </Transition>
    </div>

    <footer class="flex flex-col gap-1.5 px-4 py-3">
      <div class="-ml-2 flex items-center gap-1">
        <button
          type="button"
          class="tap-target press rounded-full"
          :class="post.likedByMe ? 'text-danger-600' : 'text-brand-600'"
          :aria-pressed="post.likedByMe"
          :aria-label="post.likedByMe ? 'Remover curtida' : 'Curtir'"
          @click="setLiked(!post.likedByMe)"
        >
          <AppIcon name="heart" class="size-7" :stroke-width="post.likedByMe ? 2.6 : 1.8" />
        </button>
      </div>

      <p v-if="post.likeCount > 0" class="text-brand-900 text-sm font-semibold">
        {{ likeLabel }}
      </p>

      <p v-if="post.caption" class="text-brand-700 text-sm whitespace-pre-line">
        <span class="text-brand-900 font-semibold">{{ post.author.name }}</span>
        {{ post.caption }}
      </p>

      <p class="text-brand-400 text-xs">{{ formatRelativeMoment(post.createdAt) }}</p>
    </footer>
  </article>
</template>
