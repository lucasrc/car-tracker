# Implementation Plan: Real-Time Fuel Consumption Tracking

**Branch**: `[001-fuel-tracking]` | **Date**: 2026-04-09 | **Spec**: [link](./spec.md)
**Input**: Feature specification from `/speckit.specify` command

## Summary

Track and display real-time fuel consumption during active trips using GPS data, with historical consumption data stored locally for analysis. The implementation extends the existing trip tracking system with consumption calculation and statistics features.

## Technical Context

**Language/Version**: TypeScript ~5.9.3  
**Primary Dependencies**: React 19, Zustand 5.x, TanStack React Query, Dexie 4.x (IndexedDB), Leaflet + react-leaflet  
**Storage**: Dexie (IndexedDB) - local device storage, no cloud sync  
**Testing**: Vitest + @testing-library/react  
**Target Platform**: Android mobile (via Capacitor), web browser for development  
**Project Type**: mobile-app (React SPA with Capacitor)  
**Performance Goals**: Real-time consumption display within 3 seconds of vehicle movement  
**Constraints**: Offline-capable, local storage only  
**Scale/Scope**: Single user, personal vehicle tracking, ~10,000 trips capacity

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Constitution file (`.specify/memory/constitution.md`) contains template placeholders only - no actual gates defined for this project. Proceeding with standard development practices.

## Project Structure

### Documentation (this feature)

```
specs/001-fuel-tracking/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (if needed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── components/
│   ├── tracker/         # Tracker UI components
│   ├── history/         # History components (existing)
│   └── ui/              # UI components (existing)
├── hooks/               # Custom React hooks
│   ├── useTripConsumptionTracker.ts  # NEW: Real-time consumption tracking
│   └── useConsumptionCalculator.ts  # NEW: Consumption calculation logic
├── stores/              # Zustand stores
│   ├── useTripStore.ts  # Existing - extend with consumption data
│   └── useFuelInventoryStore.ts  # Existing
├── lib/                 # Utilities
│   ├── consumption-model.ts  # NEW: Fuel consumption calculation algorithms
│   └── db.ts            # Existing - Dexie database
├── pages/               # Page components
│   ├── Tracker.tsx      # Existing - extend with consumption display
│   ├── History.tsx      # Existing - extend with consumption history
│   └── TripDetail.tsx   # Existing - extend with per-trip consumption
├── types/               # TypeScript types
│   └── index.ts         # Existing - extend with consumption types
└── schemas/             # Zod schemas (existing)

tests/
├── unit/                # Unit tests
├── integration/         # Integration tests
└── contract/           # Contract tests (if needed)
```

**Structure Decision**: Single React project with TypeScript - existing structure extended with new consumption tracking functionality. No new projects or external services required.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
