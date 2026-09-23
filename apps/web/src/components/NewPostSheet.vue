<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

import type { PostDto, VenueSummaryDto } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import BottomSheet from '@/components/BottomSheet.vue';
import { useToast } from '@/composables/useToast';
import { prepareImageForUpload } from '@/lib/imageFile';
import { normalizeApiError } from '@/services/http';
import { createPost } from '@/services/feed';

/** Publishing a photo: choose it, say where it was, add a line, send. */
const props = defineProps<{ venues: VenueSummaryDto[] }>();
const emit = defineEmits<{ published: [post: PostDto] }>();

const open = defineModel<boolean>('open', { required: true });

const toast = useToast();

const fileInput = ref<HTMLInputElement | null>(null);
const picked = ref<{ blob: Blob; previewUrl: string } | null>(null);
const caption = ref('');
const venueId = ref('');
const isSending = ref(false);

const canPublish = computed(() => picked.value !== null && !isSending.value);

function releasePreview(): void {
  if (picked.value) URL.revokeObjectURL(picked.value.previewUrl);
  picked.value = null;
}

onBeforeUnmount(releasePreview);

async function onFileChosen(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    releasePreview();
    // Shrunk on the device: a phone photo is several megabytes, and the person
    // is usually on mobile data at the court.
    picked.value = await prepareImageForUpload(file);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Não foi possível usar esta imagem.');
  } finally {
    // Reset the input so choosing the same file again still fires a change.
    if (fileInput.value) fileInput.value.value = '';
  }
}

function reset(): void {
  releasePreview();
  caption.value = '';
  venueId.value = '';
}

async function publish(): Promise<void> {
  if (!picked.value || isSending.value) return;
  isSending.value = true;

  try {
    const post = await createPost(picked.value.blob, {
      caption: caption.value.trim() || undefined,
      venueId: venueId.value || undefined,
    });

    emit('published', post);
    toast.success('Foto publicada.');
    reset();
    open.value = false;
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <BottomSheet v-model:open="open" title="Nova foto" description="Mostre como foi o treino.">
    <div class="flex flex-col gap-4">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="sr-only"
        aria-label="Escolher foto"
        @change="onFileChosen"
      />

      <button
        v-if="!picked"
        type="button"
        class="press border-brand-300 text-brand-500 flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed"
        @click="fileInput?.click()"
      >
        <AppIcon name="camera" class="size-8" />
        <span class="text-sm font-medium">Escolher uma foto</span>
      </button>

      <div v-else class="relative overflow-hidden rounded-2xl">
        <img :src="picked.previewUrl" alt="Prévia da foto escolhida" class="w-full object-cover" />
        <button
          type="button"
          class="tap-target press absolute top-2 right-2 rounded-full bg-black/60 text-white"
          aria-label="Escolher outra foto"
          @click="fileInput?.click()"
        >
          <AppIcon name="refresh" class="size-5" />
        </button>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="text-brand-700 text-sm font-medium">Em qual CT?</span>
        <select
          v-model="venueId"
          class="text-brand-900 border-brand-200 focus:border-aula-600 min-h-11 w-full rounded-lg border bg-white px-3 text-base outline-none"
        >
          <option value="">Não informar</option>
          <option v-for="venue in props.venues" :key="venue.id" :value="venue.id">
            {{ venue.name }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-brand-700 text-sm font-medium">Legenda</span>
        <textarea
          v-model="caption"
          rows="3"
          maxlength="500"
          placeholder="Conte como foi…"
          class="text-brand-900 placeholder:text-brand-400 border-brand-200 focus:border-aula-600 w-full rounded-lg border bg-white px-3 py-2 text-base outline-none"
        />
      </label>

      <AppButton block :disabled="!canPublish" :loading="isSending" @click="publish">
        Publicar
      </AppButton>

      <p class="text-brand-400 text-center text-xs">
        Sua foto aparece para as pessoas do app. A localização gravada pela câmera é removida.
      </p>
    </div>
  </BottomSheet>
</template>
