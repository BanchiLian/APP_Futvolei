<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { formatBrDateTime } from '@futcheck/shared';

/**
 * Phase 1 landing page.
 *
 * It exists to prove the stack is wired end to end: the browser reaches the API,
 * the API reports its environment and business timezone. It will be replaced by
 * the real home screen as the product phases land.
 */

interface HealthResponse {
  status: string;
  environment: string;
  timezone: string;
  time: string;
  uptime: number;
}

const apiOrigin = import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '');

const state = ref<'loading' | 'ok' | 'error'>('loading');
const health = ref<HealthResponse | null>(null);
const errorMessage = ref('');

async function checkApi(): Promise<void> {
  state.value = 'loading';
  errorMessage.value = '';

  try {
    const response = await fetch(`${apiOrigin}/health`);

    if (!response.ok) {
      throw new Error(`A API respondeu ${response.status}`);
    }

    health.value = (await response.json()) as HealthResponse;
    state.value = 'ok';
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Não foi possível falar com a API.';
    state.value = 'error';
  }
}

onMounted(checkApi);

const delivered = [
  'Monorepo com npm workspaces (api, web, shared)',
  'PostgreSQL 16 via Docker Compose',
  'Schema Prisma completo, com índice único parcial do super admin',
  'Seed: super admin, admin, 2 professores, 5 alunos, 3 dayuse e a grade padrão',
  'Matriz de permissões e util de datas em packages/shared',
  'Lint, format, testes e hooks de commit',
];

const next = 'Fase 2 — Autenticação e RBAC';
</script>

<template>
  <div class="bg-brand-900 text-brand-100 min-h-dvh px-4 py-10">
    <div class="mx-auto flex w-full max-w-lg flex-col gap-6">
      <header class="flex items-center gap-4">
        <img src="/icon.svg" alt="" class="size-14 rounded-2xl" width="56" height="56" />
        <div>
          <h1 class="text-2xl font-semibold text-white">FutCheck</h1>
          <p class="text-brand-300 text-sm">Fase 1 — Fundação</p>
        </div>
      </header>

      <!-- API status: loading / ok / error, each with its own state. -->
      <section class="bg-brand-800 rounded-2xl p-5" aria-labelledby="api-status-heading">
        <h2
          id="api-status-heading"
          class="text-brand-300 mb-3 text-sm font-semibold tracking-wide uppercase"
        >
          Conexão com a API
        </h2>

        <div v-if="state === 'loading'" class="flex items-center gap-3" aria-live="polite">
          <div class="bg-brand-400 h-3 w-3 animate-pulse rounded-full" />
          <div class="bg-brand-700 h-4 w-40 animate-pulse rounded" />
        </div>

        <dl v-else-if="state === 'ok' && health" class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-brand-400">Status</dt>
            <dd class="text-success-500 font-medium">{{ health.status }}</dd>
          </div>
          <div>
            <dt class="text-brand-400">Ambiente</dt>
            <dd class="font-medium text-white">{{ health.environment }}</dd>
          </div>
          <div>
            <dt class="text-brand-400">Fuso de negócio</dt>
            <dd class="font-medium text-white">{{ health.timezone }}</dd>
          </div>
          <div>
            <dt class="text-brand-400">Horário do servidor</dt>
            <dd class="font-medium text-white">{{ formatBrDateTime(health.time) }}</dd>
          </div>
        </dl>

        <div v-else class="flex flex-col gap-3" role="alert">
          <p class="text-danger-500 text-sm">
            {{ errorMessage }}
          </p>
          <p class="text-brand-400 text-xs">
            Verifique se o banco subiu (<code>npm run db:up</code>) e se a API está rodando (<code
              >npm run dev</code
            >).
          </p>
          <button
            type="button"
            class="tap-target text-brand-900 w-fit rounded-lg bg-white px-4 text-sm font-semibold"
            @click="checkApi"
          >
            Tentar novamente
          </button>
        </div>
      </section>

      <section class="bg-brand-800 rounded-2xl p-5" aria-labelledby="delivered-heading">
        <h2
          id="delivered-heading"
          class="text-brand-300 mb-3 text-sm font-semibold tracking-wide uppercase"
        >
          Entregue nesta fase
        </h2>
        <ul class="flex flex-col gap-2 text-sm">
          <li v-for="item in delivered" :key="item" class="flex gap-2">
            <span class="text-success-500" aria-hidden="true">✓</span>
            <span>{{ item }}</span>
          </li>
        </ul>
        <p class="text-brand-400 mt-4 text-sm">A seguir: {{ next }}</p>
      </section>

      <RouterLink
        :to="{ name: 'login' }"
        class="tap-target bg-dayuse-500 text-brand-900 rounded-xl px-5 font-semibold"
      >
        Ir para a tela de entrada
      </RouterLink>
    </div>
  </div>
</template>
