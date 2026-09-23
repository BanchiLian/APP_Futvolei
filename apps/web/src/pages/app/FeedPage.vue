<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { PERMISSIONS, type PostDto, type VenueSummaryDto } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ErrorState from '@/components/ErrorState.vue';
import NewPostSheet from '@/components/NewPostSheet.vue';
import PostCard from '@/components/PostCard.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import { useCan } from '@/composables/useCan';
import { useResource } from '@/composables/useResource';
import { listFeed } from '@/services/feed';
import { listVenues } from '@/services/venues';

/** The photo feed: what people have been posting from the CTs. */
const { can } = useCan();

const posts = ref<PostDto[]>([]);
const page = ref(1);
const composerOpen = ref(false);

const feed = useResource(() => listFeed({ page: page.value }));
// Only needed to fill the CT picker in the composer.
const venues = useResource(() => listVenues());

async function loadPage(nextPage: number): Promise<void> {
  page.value = nextPage;
  await feed.load();

  const result = feed.data.value;
  if (!result) return;

  posts.value = nextPage === 1 ? result.data : [...posts.value, ...result.data];
}

async function refresh(): Promise<void> {
  await loadPage(1);
}

onMounted(async () => {
  await loadPage(1);
  if (can(PERMISSIONS.FEED_POST)) void venues.load();
});

// Coming back to the tab after posting from elsewhere should not show a stale list.
onActivated(() => {
  if (posts.value.length === 0) void refresh();
});

const total = computed(() => feed.data.value?.meta.total ?? 0);
const hasMore = computed(() => posts.value.length < total.value);
const isFirstLoad = computed(() => feed.isInitialLoading.value && posts.value.length === 0);

/** The server decided the new state of the post; take it as given. */
function replacePost(updated: PostDto): void {
  posts.value = posts.value.map((post) => (post.id === updated.id ? updated : post));
}

function removePost(id: string): void {
  posts.value = posts.value.filter((post) => post.id !== id);
}

function prependPost(post: PostDto): void {
  posts.value = [post, ...posts.value];
}
</script>

<template>
  <PullToRefresh :refresh="refresh">
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <AppButton
          v-if="can(PERMISSIONS.FEED_POST)"
          class="flex-1"
          variant="secondary"
          @click="composerOpen = true"
        >
          <AppIcon name="camera" class="size-5" />
          Publicar uma foto
        </AppButton>

        <RouterLink
          v-if="can(PERMISSIONS.COMMUNITY_VIEW)"
          :to="{ name: 'community' }"
          class="tap-target press bg-brand-100 text-brand-800 gap-2 rounded-xl px-4 text-sm font-semibold"
        >
          <AppIcon name="users" class="size-5" />
          Pessoas
        </RouterLink>
      </div>

      <div v-if="isFirstLoad" class="flex flex-col gap-3">
        <SkeletonBlock v-for="index in 2" :key="index" class="h-96 rounded-2xl" />
      </div>

      <ErrorState
        v-else-if="feed.error.value && posts.length === 0"
        :message="feed.error.value"
        :retrying="feed.isFetching.value"
        @retry="refresh"
      />

      <EmptyState
        v-else-if="posts.length === 0"
        icon="image"
        title="Nenhuma foto ainda"
        description="Publique a primeira e mostre como foi o treino."
      />

      <!-- Photos run edge to edge on a phone, as a photo feed should, and settle
           into cards once there is room for margins. -->
      <div v-else class="-mx-4 flex flex-col gap-3 sm:mx-0">
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          @update="replacePost"
          @removed="removePost"
        />

        <div class="px-4 sm:px-0">
          <AppButton
            v-if="hasMore"
            variant="secondary"
            block
            :loading="feed.isFetching.value"
            @click="loadPage(page + 1)"
          >
            Carregar mais
          </AppButton>
        </div>
      </div>

      <NewPostSheet
        v-model:open="composerOpen"
        :venues="venues.data.value ?? ([] as VenueSummaryDto[])"
        @published="prependPost"
      />
    </div>
  </PullToRefresh>
</template>
