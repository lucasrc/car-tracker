# Agent Guidelines for car

This document provides guidelines for AI agents working in this codebase.

## Project Overview

- **Stack**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Validation**: Zod
- **Testing**: Vitest + @testing-library/react

## Commands

### Development

```bash
npm run dev          # Start Vite dev server with HMR
```

### Build & Preview

```bash
npm run build        # Type-check then build for production
npm run preview      # Preview production build
```

### Linting & Formatting

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
npm run format       # Format code with Prettier
npm run typecheck    # TypeScript type checking (no emit)
```

### Testing

```bash
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
```

**Run a single test file:**

```bash
npx vitest run src/components/ui/Button.test.tsx
```

**Run tests matching a pattern:**

```bash
npx vitest run -t "Button"
```

## Code Style Guidelines

### Imports

- Use path alias `@/` for imports from `src/` (e.g., `@/components/ui/Button`)
- Group imports in this order: external libraries → internal imports
- Use double quotes for all strings
- Always use explicit type imports (`import { type Foo }`)

### Naming Conventions

- **Components**: PascalCase (e.g., `Button.tsx`, `Layout.tsx`)
- **Hooks**: Start with `use` prefix, camelCase (e.g., `useMediaQuery.ts`)
- **Stores**: End with `Store`, camelCase (e.g., `useAppStore.ts`)
- **Utilities**: camelCase (e.g., `utils.ts`, `query-client.ts`)
- **Schemas**: camelCase with `Schema` suffix (e.g., `userSchema.ts`)
- **Types**: PascalCase in `types/index.ts` or co-located

### TypeScript

- Strict mode is enabled in `tsconfig.app.json`
- Prefer `interface` for public API types, `type` for unions/intersections
- Use Zod for runtime validation and `z.infer` for TypeScript types
- Never use `any` - use `unknown` if type is truly unknown
- Enable `noUnusedLocals` and `noUnusedParameters`

### React Patterns

- Use functional components with explicit return types for exported components
- Use `forwardRef` for components that need ref forwarding
- Use CVA (class-variance-authority) pattern for component variants
- Define prop interfaces explicitly, extend native HTML attributes

### Error Handling

- Throw `Error` objects for API errors with meaningful messages
- Use try/catch for async operations
- Handle errors in React Query with error boundaries or error states

### Testing

- Use Vitest with @testing-library/react
- Test file naming: `ComponentName.test.tsx`
- Follow AAA pattern: Arrange, Act, Assert
- Use `userEvent` instead of `fireEvent` for user interactions
- Mock Vitest globals with `vi.fn()`

### Tailwind CSS

- Use Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Use utility classes for styling
- Support dark mode with `dark:` prefix

## File Structure

```
src/
├── api/              # API client and endpoints
├── assets/           # Static assets
├── components/
│   ├── layout/       # Layout components (Header, Layout)
│   └── ui/           # Reusable UI components
├── hooks/            # Custom React hooks
├── lib/              # Utilities (query-client, utils)
├── pages/            # Page components
├── schemas/          # Zod schemas
├── stores/           # Zustand stores
├── test/             # Test setup and utilities
├── types/            # Global type definitions
├── App.tsx           # Root app component
├── main.tsx          # Entry point
└── index.css         # Global styles
```

## Configuration Files

- `eslint.config.js` - ESLint configuration
- `vite.config.ts` - Vite configuration with path aliases
- `tsconfig.app.json` - TypeScript configuration (strict mode)
- `package.json` - Dependencies and scripts
