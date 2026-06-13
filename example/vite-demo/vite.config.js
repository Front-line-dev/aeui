import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const aeuiBabelPlugins = [
  ['aeui/babel-plugin'],
  ['@babel/plugin-transform-react-jsx', {
    pragma: 'AEUI.createElement',
    pragmaFrag: 'AEUI.Fragment'
  }]
];

export default defineConfig({
  plugins: [
    react({
      include: /\.[jt]sx$/,
      jsxRuntime: 'classic',
      babel: {
        babelrc: false,
        configFile: false,
        plugins: aeuiBabelPlugins
      }
    })
  ]
});
