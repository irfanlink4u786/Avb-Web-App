import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig(async ({ mode }) => {
  const plugins = [
    react(),
    tailwindcss(),
    nodePolyfills({
      // List the core modules that need polyfills
      include: ['buffer', 'stream', 'path', 'util', 'process', 'events', 'os', 'crypto'],
      // No 'glob' option – it's not valid for this plugin
    }),
  ];

  // Optional custom plugin
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_') || key.startsWith('NEXT_PUBLIC_')) {
      processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
    }
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      ...processEnvDefines,
      // Provide a global `global` object for libraries that expect it
      global: 'globalThis',
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: ['.app.github.dev'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'framer-motion', 'lucide-react'],
    },
    build: {
      rollupOptions: {
        // Force Rollup to never externalize any dependency – this ensures
        // polyfills are bundled instead of being left as external.
        external: [],
      },
    },
  };
})