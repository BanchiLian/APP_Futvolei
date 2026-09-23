<script setup lang="ts">
import { ref } from 'vue';

import type { MeResponse } from '@futcheck/shared';

import AppIcon from '@/components/AppIcon.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useToast } from '@/composables/useToast';
import { prepareImageForUpload } from '@/lib/imageFile';
import { normalizeApiError } from '@/services/http';
import { removeAvatar, updateAvatar } from '@/services/me';

/**
 * The profile photo, changed in place.
 *
 * There is no cropping step: the server takes the centre of interest of the
 * image, which for a photo of a person is the person. One tap, one result.
 */
const props = defineProps<{ name: string; src: string | null }>();
const emit = defineEmits<{ updated: [me: MeResponse] }>();

const toast = useToast();

const input = ref<HTMLInputElement | null>(null);
const isBusy = ref(false);

async function onChosen(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || isBusy.value) return;

  isBusy.value = true;

  try {
    const { blob, previewUrl } = await prepareImageForUpload(file);
    URL.revokeObjectURL(previewUrl);

    emit('updated', await updateAvatar(blob));
    toast.success('Foto atualizada.');
  } catch (error) {
    toast.error(
      error instanceof Error && error.name.startsWith('Image')
        ? error.message
        : normalizeApiError(error).message,
    );
  } finally {
    isBusy.value = false;
    if (input.value) input.value.value = '';
  }
}

async function clear(): Promise<void> {
  isBusy.value = true;

  try {
    emit('updated', await removeAvatar());
    toast.success('Foto removida.');
  } catch (error) {
    toast.error(normalizeApiError(error).message);
  } finally {
    isBusy.value = false;
  }
}
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="relative">
      <UserAvatar :name="props.name" :src="props.src" size="xl" />

      <button
        type="button"
        class="press bg-aula-600 absolute -right-1 -bottom-1 flex size-11 items-center justify-center rounded-full text-white ring-4 ring-white disabled:opacity-60"
        :aria-label="props.src ? 'Trocar foto do perfil' : 'Adicionar foto do perfil'"
        :disabled="isBusy"
        @click="input?.click()"
      >
        <AppIcon v-if="!isBusy" name="camera" class="size-5" />
        <span
          v-else
          class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      </button>

      <input
        ref="input"
        type="file"
        accept="image/*"
        class="sr-only"
        aria-label="Escolher foto do perfil"
        @change="onChosen"
      />
    </div>

    <div class="min-w-0 flex-1">
      <slot />

      <button
        v-if="props.src"
        type="button"
        class="text-brand-500 inline-flex min-h-11 items-center text-xs font-medium"
        :disabled="isBusy"
        @click="clear"
      >
        Remover foto
      </button>
    </div>
  </div>
</template>
