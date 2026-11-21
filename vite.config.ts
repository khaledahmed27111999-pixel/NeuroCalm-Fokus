import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import * as esbuild from 'esbuild';
import path from 'path';

function workletBundlePlugin(): Plugin {
  const compileWorklet = () => {
    esbuild.buildSync({
      entryPoints: [path.resolve(__dirname, 'src/audio/worklets/noiseProcessor.ts')],
      outfile: path.resolve(__dirname, 'public/worklets/noiseProcessor.js'),
      bundle: true,
      format: 'iife',
      target: 'es2020',
    });
  };

  return {
    name: 'neurocalm-worklet-bundle',
    buildStart() {
      compileWorklet();
    },
    configureServer() {
      compileWorklet();
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), workletBundlePlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
