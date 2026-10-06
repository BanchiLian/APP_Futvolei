import { createApp } from 'vue';
import { createPinia } from 'pinia';

import { configureBusinessTimezone } from '@futcheck/shared';

import App from './App.vue';
import { router } from './router';
import { api } from './services/http';
import './styles/main.css';

// The web app formats dates in the same business timezone the API reasons in.
configureBusinessTimezone('America/Sao_Paulo');

/**
 * In a demo build there is no API to talk to: GitHub Pages serves static files
 * only. Swapping the axios transport keeps every screen, store and service
 * untouched — they still believe they are talking to the server.
 *
 * The condition is a build-time constant, so the demo code and its snapshot are
 * dropped entirely from the real build.
 */
if (import.meta.env.VITE_DEMO === 'true') {
  const { demoAdapter } = await import('./demo/server');
  api.defaults.adapter = demoAdapter;
}

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');
