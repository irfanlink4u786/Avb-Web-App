import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [react(), tailwindcss()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  
  // FIX: Only define environment variables that are actually used
  // and ensure they are properly stringified
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    // Only include VITE_ and NEXT_PUBLIC_ prefixed variables
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
    // Add this to help with debugging
    optimizeDeps: {
      include: ['react', 'react-dom', 'framer-motion', 'lucide-react'],
    },
  };
})