# Opulus Gems - Component Library Setup

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the library:**
   ```bash
   npm run build
   ```

   Or for development with watch mode:
   ```bash
   npm run dev
   ```

3. **Type check:**
   ```bash
   npm run type-check
   ```

## Package Structure

```
opulus-gems/
├── src/
│   ├── components/          # Component implementations
│   │   └── ExampleCard/     # Example component
│   ├── lib/                 # Utilities
│   │   └── utils.ts        # cn() helper
│   ├── styles.css          # Tailwind CSS
│   └── index.ts            # Public API exports
├── dist/                    # Built output (gitignored)
├── package.json
├── tsconfig.json
└── tsup.config.ts          # Build configuration
```

## Adding Components

1. Create component folder: `src/components/YourComponent/`
2. Create `YourComponent.tsx`
3. Create `YourComponent.stories.tsx` (for Storybook)
4. Create `index.ts` to export the component
5. Export from `src/index.ts`:
   ```ts
   export { YourComponent } from './components/YourComponent';
   ```
6. Build: `npm run build`

## Usage in Frontend

```tsx
import { ExampleCard } from '@opulus/gems';
import '@opulus/gems/styles';
```

## Storybook

Storybook is configured in `opulus-gems` to visualize and test components in isolation.

**Start Storybook:**
```bash
npm run storybook
```

**Build Storybook for production:**
```bash
npm run build-storybook
```

Stories are discovered automatically by Storybook in `opulus-gems`. Stories should be placed alongside components:

```
src/components/YourComponent/
├── YourComponent.tsx
├── YourComponent.stories.tsx  ← Storybook story
└── index.ts
```

## Build Output

The build generates:
- `dist/index.js` - ES module bundle
- `dist/index.d.ts` - TypeScript declarations
- `dist/styles.css` - Compiled CSS

## Development Workflow

1. Make changes in `src/`
2. Run `npm run dev` to watch and rebuild
3. Frontend will pick up changes automatically (via file dependency link)
4. Test in Storybook: `npm run storybook`

