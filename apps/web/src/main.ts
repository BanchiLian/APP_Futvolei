import { createApp } from 'vue';
import { createPinia } from 'pinia';

import { configureBusinessTimezone } from '@futcheck/shared';

import App from './App.vue';
import { router } from './router';
import './styles/main.css';

// The web app formats dates in the same business timezone the API reasons in.
configureBusinessTimezone('America/Sao_Paulo');

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');
