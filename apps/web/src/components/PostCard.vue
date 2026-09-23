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

/**
 * Reserving the exact aspect ratio keeps the feed from jumping while photos
 * load — the thing that makes a web page feel unlike an app.
 */
const aspectRatio = computed(() => `${props.post.width} / ${props.post.height}`);

async function toggleLike(): Promise<void> {
  if (isLiking.value) return;
  isLiking.value = true;
  tapFeedback();

  try {
    // The server returns the post, so the count on screen is its count, not ours.
    const updated = props.post.likedByMe
      ? await unlikePost(props.post.id)
      : await likePost(props.post.id);

    emit('update', updated);
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isLiking.value = false;
  }
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
  <article class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
    <header class="flex items-center gap-3 p-3">
      <UserAvatar :name="post.author.name" :src="post.author.avatarUrl" size="sm" />

      <div class="min-w-0 flex-1">
        <p class="text-brand-900 truncate text-sm font-semibold">{{ post.author.name }}</p>
        <p class="text-brand-500 truncate text-xs">
          <RouterLink
            v-if="post.venue"
            :to="{ name: 'venue-detail', params: { id: post.venue.id } }"
            class="text-aula-700 -my-3 inline-flex min-h-11 items-center font-medium"
          >
            {{ post.venue.name }}
          </RouterLink>
          <span v-if="post.venue"> · </span>
          {{ formatRelativeMoment(post.createdAt) }}
        </p>
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
      class="bg-danger-50 flex items-center justify-between gap-3 px-3 pb-3"
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

    <!-- The image carries the caption as its description, so it is not silent to
         a screen reader; there is no separate alt text to ask the author for. -->
    <img
      :src="post.imageUrl"
      :alt="post.caption ?? `Foto publicada por ${post.author.name}`"
      :style="{ aspectRatio }"
      class="bg-brand-100 w-full object-cover"
      loading="lazy"
      decoding="async"
    />

    <footer class="flex flex-col gap-2 p-3">
      <button
        type="button"
        class="tap-target press -ml-2 w-fit gap-2 rounded-full px-2"
        :class="post.likedByMe ? 'text-danger-600' : 'text-brand-500'"
        :aria-pressed="post.likedByMe"
        :aria-label="post.likedByMe ? 'Remover curtida' : 'Curtir'"
        @click="toggleLike"
      >
        <AppIcon name="heart" class="size-6" :stroke-width="post.likedByMe ? 2.4 : 1.8" />
        <span class="text-sm font-semibold">{{ post.likeCount }}</span>
      </button>

      <p v-if="post.caption" class="text-brand-700 text-sm whitespace-pre-line">
        {{ post.caption }}
      </p>
    </footer>
  </article>
</template>
