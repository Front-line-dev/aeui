import resolve from '@rollup/plugin-node-resolve';

const external = [
  '@babel/core',
  '@babel/plugin-transform-react-jsx',
  'parse5',
];

export default [
  // Build Library (ESM & CJS)
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/aeui.cjs',
        format: 'cjs',
        exports: 'named',
        sourcemap: true
      },
      {
        file: 'dist/aeui.esm.js',
        format: 'es',
        sourcemap: true
      }
    ],
    plugins: [resolve()]
  },
  // Build Babel Plugin (CJS only, default export)
  {
    input: 'src/babel-plugin.js',
    output: [
      {
        file: 'dist/babel-plugin.cjs',
        format: 'cjs',
        exports: 'default',
        sourcemap: true
      },
      {
        file: 'dist/babel-plugin.js',
        format: 'es',
        sourcemap: true
      }
    ],
    plugins: [resolve()]
  },
  {
    input: 'src/vite-plugin.js',
    external,
    output: [
      {
        file: 'dist/vite-plugin.cjs',
        format: 'cjs',
        exports: 'default',
        sourcemap: true
      },
      {
        file: 'dist/vite-plugin.js',
        format: 'es',
        sourcemap: true
      }
    ],
    plugins: [resolve()]
  }
];
