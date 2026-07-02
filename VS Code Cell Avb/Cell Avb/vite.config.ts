import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // Start with core plugins
  const plugins = [
    react(),
    tailwindcss(),
    nodePolyfills({
      // Include the most common Node.js core modules
      include: ['buffer', 'stream', 'path', 'util', 'process', 'events', 'os'],
      // You can also use glob patterns, e.g.:
      // include: ['buffer', 'stream'],
      // Or include all:
      // include: ['*'],
      // To exclude specific ones:
      // exclude: ['crypto'],
    }),
  ];

  // Optional: load extra plugin from ./.vite-source-tags.js if exists
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  
  // Define environment variables for client-side usage
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_') || key.startsWith('NEXT_PUBLIC_')) {
      processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
    }
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
    server: {
      host: '0.0.0.0',
      allowedHosts: ['.app.github.dev'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'framer-motion', 'lucide-react'],
    },
    build: {
      rollupOptions: {
        // Prevent Vite from externalizing core Node modules
        external: [],
      },
    },
  };
})