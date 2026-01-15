# Opulus Gems

Reusable component library for Opulus applications.

## Overview

`@opulus/gems` is a component library built on top of Radix UI and Tailwind CSS. It provides reusable, accessible components that can be used across Opulus applications.

**Contains:**
- shadcn/ui base components (`Button`, `Card`, etc.)
- Storybook for component development
- All component utilities and styles

## Usage

```tsx
import { Button, ExampleCard } from '@opulus/gems';
import '@opulus/gems/styles';
```

## Development


### Adding shadcn/ui Components

```bash
# From opulus-gems directory
cd opulus-gems
npx shadcn@latest add [component-name]
```

Components will be added to `src/components/ui/` automatically.

**Note:** Make sure to export new components from `src/index.ts` after adding them.

### Adding Custom Components

1. Create component in `src/components/YourComponent/`
2. Create Storybook story: `YourComponent.stories.tsx`
3. Export from `src/index.ts`
4. Build: `npm run build`

## Project Structure

```
opulus-gems/
├── .storybook/          # Storybook configuration
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   └── ...          # Custom components
│   ├── lib/              # Utilities (cn, etc.)
│   ├── styles.css        # Tailwind CSS + CSS variables
│   └── index.ts          # Public API exports
├── components.json       # shadcn/ui configuration
└── package.json
```

## Storybook Organization

Components are organized in Storybook:
- `UI/*` - shadcn/ui base components
- `Library/*` - Custom reusable components

## Build Output

The build generates:
- `dist/index.js` - ES module bundle
- `dist/index.d.ts` - TypeScript declarations
- `dist/styles.css` - Compiled CSS

## Development Workflow

1. Make changes in `src/`
2. Frontend automatically picks up changes (watches `dist/` folder)
3. No manual rebuilds needed during development

## Related Documentation

- [Main README](../../README.md) - Repo-wide setup and prerequisites
- [Frontend Package](../opulus-frontend/README.md) - Usage examples


