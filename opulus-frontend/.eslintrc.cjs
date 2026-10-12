const path = require('path');

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
  env: { browser: true, es2020: true },
  plugins: ['react-refresh', 'prettier', 'import', 'sort-exports'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:import/recommended',
    'plugin:@tanstack/query/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:react-hooks/recommended',
    'prettier',
    // 'plugin:storybook/recommended', // Commented out - plugin not installed
  ],
  rules: {
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true,
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: false,
      },
    ],
    'import/no-unresolved': 'error',
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['sibling', 'parent'],
          'index',
          'unknown',
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'sort-exports/sort-exports': ['error', { sortDir: 'asc' }],
    '@typescript-eslint/no-misused-promises': [
      2,
      {
        checksVoidReturn: {
          attributes: false,
        },
      },
    ],
    'react/prop-types': 'off',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@opulus/core',
            message:
              "Import contracts from '@opulus/core/dto'. The root also exports Prisma, the Plaid gateway and the queue, which must never reach the browser bundle.",
          },
        ],
        patterns: [
          {
            group: ['./*/', '**../'],
            message: 'Relative imports are not allowed.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Pages and shared components display what the API returns; they do not
      // add it up. See "The server owns the data" in docs/CONVENTIONS.md.
      files: ['src/pages/**/*.{ts,tsx}', 'src/common/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.property.name='reduce']",
            message:
              'Do not add up API data in the client: the server owns aggregates (docs/CONVENTIONS.md, "The server owns the data"). If this is display work, say why in an eslint-disable comment.',
          },
          {
            selector: "NewExpression[callee.name='Map']",
            message:
              'Do not group or total API data in the client: the server owns aggregates (docs/CONVENTIONS.md, "The server owns the data"). If this is display work, say why in an eslint-disable comment.',
          },
        ],
      },
    },
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: path.resolve(__dirname, './tsconfig.json'),
        alwaysTryTypes: true,
      },
      alias: {
        map: [
          ['@', path.resolve(__dirname, './src')],
          ['@opulus/core', path.resolve(__dirname, '../opulus-core/src/index.ts')],
        ],
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
    },
    react: { version: 'detect' },
  },
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    'tailwind.config.js',
    'src/components/ui/**',
  ],
};
