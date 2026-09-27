import { defineConfig, Plugin } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Resolves Figma Make's figma:asset/* virtual imports to /assets/<filename>
// so standard Vite builds (Vercel, etc.) can compile without the Figma sandbox.
function figmaAssetPlugin(): Plugin {
  return {
    name: 'figma-asset',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) return '\0' + id;
    },
    load(id) {
      if (id.startsWith('\0figma:asset/')) {
        const filename = id.replace('\0figma:asset/', '');
        return `export default "/assets/${filename}";`;
      }
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    figmaAssetPlugin(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    allowedHosts: ['.manus.computer'],
  },

  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
})
