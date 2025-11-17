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
    '@radix-ui/react-avatar',
    '@radix-ui/react-collapsible',
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-label',
    '@radix-ui/react-separator',
    '@radix-ui/react-slot',
    '@radix-ui/react-tooltip',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
  ],
  treeshake: true,
  outDir: 'dist',
});

