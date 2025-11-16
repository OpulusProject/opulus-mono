import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/styles.css'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@radix-ui/react-slot',
    '@radix-ui/react-label',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
  ],
  treeshake: true,
  outDir: 'dist',
});

