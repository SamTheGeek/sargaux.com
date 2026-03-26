// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import node from '@astrojs/node';

// https://astro.build/config
const useNodeAdapter = process.env.ASTRO_ADAPTER === 'node';

export default defineConfig({
  output: 'server',
  adapter: useNodeAdapter ? node({ mode: 'standalone' }) : netlify(),
  security: {
    checkOrigin: process.env.ASTRO_CHECK_ORIGIN !== 'false',
  },
  server: {
    port: 1213
  }
});
