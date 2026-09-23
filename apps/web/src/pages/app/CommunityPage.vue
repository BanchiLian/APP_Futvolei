<script setup lang="ts">
import { ref } from 'vue';

import CommunityDirectory from '@/components/CommunityDirectory.vue';
import PhotoFeed from '@/components/PhotoFeed.vue';
import PullToRefresh from '@/components/PullToRefresh.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';

/**
 * The social tab, in two halves: the photo feed and the member directory.
 *
 * They share one tab rather than taking two of the five slots in the bottom bar,
 * and the feed leads because it is what people open the app to look at.
 */
type Section = 'photos' | 'people';

const section = ref<Section>('photos');

const feed = ref<InstanceType<typeof PhotoFeed> | null>(null);
const directory = ref<InstanceType<typeof CommunityDirectory> | null>(null);

/** Pull-to-refresh belongs to the tab, so it reloads whichever half is showing. */
async function refresh(): Promise<void> {
  await (section.value === 'photos' ? feed.value?.refresh() : directory.value?.refresh());
}
</script>

<template>
  <PullToRefresh :refresh="refresh">
    <div class="flex flex-col gap-4">
      <SegmentedControl
        v-model="section"
        :options="[
          { value: 'photos', label: 'Fotos' },
          { value: 'people', label: 'Pessoas' },
        ]"
        label="O que mostrar na comunidade"
      />

      <!-- Both stay mounted so switching back keeps what was already loaded. -->
      <PhotoFeed v-show="section === 'photos'" ref="feed" />
      <CommunityDirectory v-show="section === 'people'" ref="directory" />
    </div>
  </PullToRefresh>
</template>
