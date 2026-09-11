import resolve from '@rollup/plugin-node-resolve';

const external = [
  '@babel/core',
  '@babel/plugin-transform-react-jsx',
  'parse5',
  '@swc/core',
  'magic-string',
  '@jridgewell/remapping',
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
  // Keep the existing standalone runtime; JSX entries share its instance.
  ...['jsx-runtime', 'jsx-dev-runtime'].map((name) => ({
    input: `src/${name}.js`,
    external: ['./core.js', './jsx-runtime.js'],
    output: ['es', 'cjs'].map((format) => ({
      file: `dist/${name}.${format === 'es' ? 'js' : 'cjs'}`,
      format,
      exports: 'named',
      sourcemap: true,
      paths(id) {
        if (id.endsWith('/core.js')) return format === 'es' ? './aeui.esm.js' : './aeui.cjs';
        if (id.endsWith('/jsx-runtime.js')) return format === 'es' ? './jsx-runtime.js' : './jsx-runtime.cjs';
        return id;
      },
    })),
  })),
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
    input: 'src/swc-transform.js',
    external,
    output: [
      { file: 'dist/swc-transform.js', format: 'es', sourcemap: true },
      { file: 'dist/swc-transform.cjs', format: 'cjs', exports: 'default', sourcemap: true },
    ],
  },
  {
    input: 'src/vite-plugin.js',
    external: [...external, './swc-transform.js', './babel-plugin.js'],
    output: [
      {
        file: 'dist/vite-plugin.cjs',
        format: 'cjs',
        exports: 'default',
        sourcemap: true,
        paths(id) {
          if (id.endsWith('/swc-transform.js')) return './swc-transform.cjs';
          if (id.endsWith('/babel-plugin.js')) return './babel-plugin.cjs';
          return id;
        },
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
