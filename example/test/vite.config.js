import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic',
      // .jsx 파일에만 babel plugin 적용 (dist 파일 제외)
      include: '**/*.jsx',
      babel: {
        plugins: [
          ['aeui/babel-plugin'],
          ['@babel/plugin-transform-react-jsx', {
            pragma: 'AEUI.createElement',
            pragmaFrag: 'AEUI.Fragment'
          }]
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true
  }
});
