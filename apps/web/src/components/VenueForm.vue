<script setup lang="ts">
import { computed, reactive, watch } from 'vue';

import type { VenueAdminDto, VenueWriteInput } from '@futcheck/shared';

import AppButton from '@/components/AppButton.vue';

/**
 * The CT's own data, shared by the create and edit screens so the two cannot
 * drift apart in which fields they ask for or how they validate them.
 *
 * Coordinates are typed in rather than picked on a map: a map is the right
 * answer and a bigger job, and until then a CT with wrong coordinates would be
 * sorted to the wrong place in everyone's "near me".
 */
const props = defineProps<{
  venue?: VenueAdminDto | null;
  saving?: boolean;
  submitLabel: string;
}>();
const emit = defineEmits<{ submit: [value: VenueWriteInput] }>();

const form = reactive({
  name: '',
  description: '',
  address: '',
  city: '',
  state: 'SP',
  latitude: '' as number | string,
  longitude: '' as number | string,
  phone: '',
  instagram: '',
});

watch(
  () => props.venue,
  (venue) => {
    if (!venue) return;

    Object.assign(form, {
      name: venue.name,
      description: venue.description ?? '',
      address: venue.address,
      city: venue.city,
      state: venue.state,
      latitude: venue.latitude,
      longitude: venue.longitude,
      phone: venue.phone ?? '',
      instagram: venue.instagram ?? '',
    });
  },
  { immediate: true },
);

const isValid = computed(
  () =>
    form.name.trim().length >= 2 &&
    form.address.trim().length >= 3 &&
    form.city.trim().length >= 2 &&
    /^[A-Za-z]{2}$/.test(form.state.trim()) &&
    Number.isFinite(Number(form.latitude)) &&
    Number.isFinite(Number(form.longitude)) &&
    String(form.latitude).trim() !== '' &&
    String(form.longitude).trim() !== '',
);

function submit(): void {
  if (!isValid.value) return;

  emit('submit', {
    name: form.name.trim(),
    description: form.description.trim() || null,
    address: form.address.trim(),
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    phone: form.phone.replace(/\D/g, '') || null,
    instagram: form.instagram.replace(/^@/, '').trim() || null,
  });
}

const FIELD =
  'border-brand-200 text-brand-900 placeholder:text-brand-400 min-h-11 w-full rounded-xl border bg-white px-3 text-base';
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <label class="flex flex-col gap-1">
      <span class="text-brand-700 text-sm font-medium">Nome do CT</span>
      <input v-model="form.name" type="text" maxlength="120" :class="FIELD" required />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-brand-700 text-sm font-medium">Endereço</span>
      <input v-model="form.address" type="text" maxlength="255" :class="FIELD" required />
    </label>

    <div class="flex gap-3">
      <label class="flex flex-[2] flex-col gap-1">
        <span class="text-brand-700 text-sm font-medium">Cidade</span>
        <input v-model="form.city" type="text" maxlength="80" :class="FIELD" required />
      </label>
      <label class="flex flex-1 flex-col gap-1">
        <span class="text-brand-700 text-sm font-medium">UF</span>
        <input v-model="form.state" type="text" maxlength="2" :class="FIELD" required />
      </label>
    </div>

    <div class="flex gap-3">
      <label class="flex flex-1 flex-col gap-1">
        <span class="text-brand-700 text-sm font-medium">Latitude</span>
        <input v-model="form.latitude" type="number" step="any" :class="FIELD" required />
      </label>
      <label class="flex flex-1 flex-col gap-1">
        <span class="text-brand-700 text-sm font-medium">Longitude</span>
        <input v-model="form.longitude" type="number" step="any" :class="FIELD" required />
      </label>
    </div>

    <p class="text-brand-400 -mt-2 text-xs">
      As coordenadas são o que coloca o CT no lugar certo em “perto de você”.
    </p>

    <label class="flex flex-col gap-1">
      <span class="text-brand-700 text-sm font-medium">Telefone (opcional)</span>
      <input v-model="form.phone" type="tel" placeholder="11999999999" :class="FIELD" />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-brand-700 text-sm font-medium">Instagram (opcional)</span>
      <input v-model="form.instagram" type="text" placeholder="seu.ct" :class="FIELD" />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-brand-700 text-sm font-medium">Descrição (opcional)</span>
      <textarea v-model="form.description" rows="3" maxlength="1000" :class="FIELD" />
    </label>

    <AppButton type="submit" block :disabled="!isValid" :loading="saving">
      {{ submitLabel }}
    </AppButton>
  </form>
</template>
