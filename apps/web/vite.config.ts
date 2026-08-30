import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

export default defineConfig({
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true }, proxy: { '/api': 'http://127.0.0.1:3210' } }
      : { proxy: { '/api': 'http://127.0.0.1:3210' } },
    plugins: [react(), sites()],
  });
