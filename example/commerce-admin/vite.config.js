import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic', // Use classic to allow pragma customization
      babel: {
        plugins: [
          // This plugin handles 'watch' deps and component factories naturally
          ['aeui/babel-plugin'],
          // Transform JSX to AEUI.createElement
          ['@babel/plugin-transform-react-jsx', {
            pragma: 'AEUI.createElement',
            pragmaFrag: 'AEUI.Fragment'
          }]
        ]
      }
    })
  ]
});

