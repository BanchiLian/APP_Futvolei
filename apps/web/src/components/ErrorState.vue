<script setup lang="ts">
import AppButton from '@/components/AppButton.vue';
import AppIcon from '@/components/AppIcon.vue';

withDefaults(defineProps<{ message: string; title?: string; retrying?: boolean }>(), {
  title: 'Não foi possível carregar',
  retrying: false,
});

defineEmits<{ retry: [] }>();
</script>

<template>
  <section
    class="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-10 text-center"
    role="alert"
  >
    <span
      class="bg-danger-50 text-danger-600 flex size-14 items-center justify-center rounded-full"
    >
      <AppIcon name="alert" class="size-7" />
    </span>
    <h2 class="text-brand-900 text-base font-semibold">{{ title }}</h2>
    <p class="text-brand-500 max-w-xs text-sm">{{ message }}</p>
    <AppButton variant="secondary" :loading="retrying" @click="$emit('retry')">
      <AppIcon name="refresh" class="size-4" />
      Tentar novamente
    </AppButton>
  </section>
</template>
