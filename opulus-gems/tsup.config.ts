import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/styles.css'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  esbuildOptions(options) {
    options.resolveExtensions = ['.tsx', '.ts', '.jsx', '.js', '.json'];
    options.alias = {
      '@': './src',
    };
  },
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
    '@radix-ui/react-toggle',
    '@radix-ui/react-tabs',
    '@radix-ui/react-checkbox',
    '@radix-ui/react-select',
    '@radix-ui/react-toggle-group',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
    'recharts',
    'vaul',
  ],
  treeshake: true,
  outDir: 'dist',
});

