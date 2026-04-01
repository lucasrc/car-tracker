# Agent Guidelines for car

This document provides guidelines for AI agents working in this codebase.

## Project Overview

- **Stack**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Runtime**: Bun
- **State Management**: Zustand (with devtools + persist middleware)
- **Data Fetching**: TanStack React Query
- **Validation**: Zod
- **Testing**: Vitest + @testing-library/react
- **Database**: Dexie (IndexedDB wrapper)
- **Maps**: Leaflet + react-leaflet
- **Charts**: Recharts
- **Routing**: React Router DOM

## Commands

### Development

```bash
bun run dev          # Start Vite dev server with HMR
```

### Build & Preview

```bash
bun run build        # Type-check then build for production
bun run preview      # Preview production build
```

### Linting & Formatting

```bash
bun run lint         # Run ESLint
bun run lint:fix     # Fix ESLint issues automatically
bun run format       # Format code with Prettier
bun run typecheck    # TypeScript type checking (no emit)
```

### Testing

```bash
bun run test         # Run tests in watch mode
bun run test:run     # Run tests once
```

**Run a single test file:**

```bash
bunx vitest run src/components/ui/Button.test.tsx
```

**Run tests matching a pattern:**

```bash
bunx vitest run -t "Button"
```

### Android Deployment

**Setup (one-time):**

1. Connect Android device via USB
2. Enable Developer Options: Settings → About Phone → Build Number (tap 7x)
3. Enable Wireless Debugging: Settings → System → Developer Options → Wireless Debugging
4. Allow USB debugging when prompted
5. Execute: `adb tcpip 5555` (restarts ADB in TCP mode)
6. Get device IP: Settings → Wi-Fi → tap connected network
7. Disconnect USB and connect via WiFi: `adb connect <DEVICE_IP>:5555`

**Development workflow:**

```bash
bun run android:deploy     # Build + sync + install + launch (Recommended)
bun run android:sync      # Build + sync only
bun run android:install    # Install APK on connected device
bun run android:start      # Launch app on device
bun run android:open       # Open Android project in Android Studio
```

**Useful ADB commands:**

```bash
adb devices                           # List connected devices
adb connect <IP>:PORT                # Connect via WiFi (e.g., adb connect 192.168.0.5:5555)
adb disconnect                        # Disconnect current device
adb install -r app.apk               # Install/reinstall APK
adb shell am start -n com.car.tracker/.MainActivity  # Launch app
adb -s <DEVICE_IP:PORT> <command>    # Target specific device
```

## Code Style Guidelines

### Imports

- Use path alias `@/` for imports from `src/` (e.g., `@/components/ui/Button`)
- Group imports in this order: external libraries → internal imports
- Use double quotes for all strings
- Always use explicit type imports (`import { type Foo }`)

### Naming Conventions

- **Components**: PascalCase (e.g., `Button.tsx`, `Layout.tsx`)
- **Hooks**: Start with `use` prefix, camelCase (e.g., `useGeolocation.ts`)
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

### Zustand Stores

- Use `devtools` and `persist` middleware
- Separate state interface from actions interface
- Use explicit return type with `create<State & Actions>()`

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
├── api/                   # API client and endpoints
├── assets/                # Static assets (images, icons)
├── components/
│   ├── layout/            # Layout components (Header, Layout, BottomNav)
│   ├── ui/                # Reusable UI components (Button, Input, ConfirmDialog)
│   ├── tracker/           # Tracker-specific components (Dashboard, MapTracker, Speedometer, TripCard)
│   └── history/           # History-specific components (FuelCharts, UsagePatterns, SpeedAnalysis)
├── hooks/                 # Custom React hooks (useGeolocation, useWakeLock, useSimulation)
├── lib/                   # Utilities (query-client, db, utils, distance)
├── pages/                 # Page components (Home, Tracker, History, Settings, About)
├── schemas/               # Zod schemas (userSchema)
├── stores/                # Zustand stores (useAppStore, useTripStore)
├── test/                  # Test setup and utilities
├── types/                 # Global type definitions (Coordinates, Trip, Settings, Refuel)
├── App.tsx                # Root app component
├── main.tsx               # Entry point
└── index.css              # Global styles
```

## Configuration Files

- `eslint.config.js` - ESLint configuration
- `vite.config.ts` - Vite configuration with path aliases
- `tsconfig.app.json` - TypeScript configuration (strict mode)
- `package.json` - Dependencies and scripts

---

## Quick Navigation Index

### Core Architecture

| Area         | Key Files                                         | Purpose                                      |
| ------------ | ------------------------------------------------- | -------------------------------------------- |
| **State**    | `stores/useTripStore.ts`, `stores/useAppStore.ts` | Trip recording, app theme                    |
| **Database** | `lib/db.ts`                                       | Dexie tables: `trips`, `settings`, `refuels` |
| **Types**    | `types/index.ts`                                  | `Trip`, `Settings`, `Refuel`, `Coordinates`  |

### Components by Feature

| Feature     | Components                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------- |
| **Tracker** | `Dashboard`, `MapTracker`, `Speedometer`, `TripInfo`, `TripControls`, `TripCard`, `TrackerHeader` |
| **History** | `FuelCharts`, `SpeedAnalysis`, `UsagePatterns`, `TimeAnalysis`, `TripSummary`, `RefuelCard`       |
| **UI**      | `Button`, `Input`, `ConfirmDialog`, `DateRangePicker`, `Tabs`                                     |
| **Layout**  | `Header`, `BottomNav`, `Layout`                                                                   |

### Key Hooks

| Hook                        | Purpose          |
| --------------------------- | ---------------- |
| `useGeolocation`            | GPS tracking     |
| `useTripConsumptionTracker` | Fuel calculation |
| `useConsumptionModel`       | Consumption math |
| `useSimulation`             | Demo mode        |

### DB Operations (`lib/db.ts`)

- `getSettings()`, `saveSettings()` - User preferences
- `saveTrip()`, `getAllTrips()`, `getTripById()`, `deleteTrip()` - Trip CRUD
- `addRefuel()`, `getRefuels()`, `deleteRefuel()` - Fuel log
- `refuel()`, `consumeFuel()` - Tank management

### Routing (App.tsx)

```
/ → Home        /tracker → Tracker      /history → History
/settings → Settings    /about → About    /trip/:id → TripDetail
```
