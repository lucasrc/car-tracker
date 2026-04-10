# Car Tracker Constitution

## Core Principles

### I. Component Single Responsibility

Every component MUST have a single, well-defined purpose. Extract reusable logic into custom hooks. Components larger than 200 lines should be evaluated for decomposition. Props interfaces MUST be explicit and extend native HTML attributes where applicable.

### II. Atomic Component Design

Build small, focused UI primitives before composing them into larger features. Follow the CVA (class-variance-authority) pattern for component variants. Reusable UI components belong in `components/ui/`, feature-specific components in their respective feature directories.

### III. Test-First Development (NON-NEGOTIABLE)

Tests MUST be written BEFORE implementation. Use Vitest with @testing-library/react. Follow AAA pattern: Arrange, Act, Assert. Use `userEvent` for user interactions, not `fireEvent`. Mock Vitest globals with `vi.fn()`. Every new feature or bug fix requires corresponding tests.

### IV. TypeScript Strict Mode

NEVER use `any` - use `unknown` if type is truly unknown. Prefer `interface` for public API types, `type` for unions/intersections. Enable `noUnusedLocals` and `noUnusedParameters`. Use Zod for runtime validation and `z.infer` for TypeScript types.

### V. Explicit Imports & Naming

Use path alias `@/` for imports from `src/`. Naming conventions: PascalCase components, camelCase hooks with `use` prefix, camelCase utilities, `Store` suffix for Zustand stores. Group imports: external libraries first, then internal imports. Always use explicit type imports.

### VI. State Colocation

Keep state as close as possible to where it is used. Prefer local `useState` for UI-only state. Global state (Zustand) only for truly shared state like user preferences, active trip data, or theme. Use TanStack Query for server state.

### VII. Documentation with Code

When changing logic, update corresponding documentation in `docs/`. Use JSDoc for complex utilities and algorithms. Document intentional design decisions in `docs/decisions.md` as ADRs. Keep glossary updated in `docs/glossary.md`.

## Technology Stack

**Runtime & Language**: TypeScript ~5.9.3, React 19, Bun runtime

**State Management**: Zustand with devtools + persist middleware for client state; TanStack React Query for server state

**Database**: Dexie 4.x (IndexedDB wrapper) - local device storage only, no cloud sync

**Testing**: Vitest + @testing-library/react

**UI**: Tailwind CSS v4 with @tailwindcss/vite plugin; Leaflet + react-leaflet for maps; Recharts for charts

**Routing**: React Router DOM

**Build**: Vite with path aliases; Capacitor for Android deployment

## Development Workflow

**Code Quality Gates**:

- `bun run typecheck` MUST pass before commit
- `bun run lint` MUST pass before commit
- Tests MUST pass: `bun run test:run`
- Build MUST succeed: `bun run build`

**Testing Requirements**:

- Unit tests for utilities and hooks: `src/lib/*.test.ts`, `src/hooks/*.test.ts`
- Component tests: `src/components/**/*.test.tsx`
- Integration tests: `src/**/*.integration.test.ts`
- Test file naming: `ComponentName.test.tsx`

**Commit Conventions**:

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Keep commits atomic and focused

## Governance

**Constitution Authority**: This constitution supersedes all other development practices. All PRs and code reviews MUST verify compliance with these principles.

**Amendment Process**:

1. Propose changes with rationale in an issue or PR
2. Document impact on existing code and tests
3. Obtain approval before merging
4. Update version in constitution header

**Complexity Justification**: Any violation of these principles (e.g., adding a 4th party library, creating a utility library without clear purpose) MUST be documented in `docs/decisions.md` with simpler alternatives rejected and reasoning.

**Version**: 1.0.0 | **Ratified**: 2026-04-09 | **Last Amended**: 2026-04-09
