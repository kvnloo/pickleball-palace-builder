## Assumptions

- **Unit system**: Using meters internally (1 ft = 0.3048 m) for Three.js consistency
- **Axis system**: X = columns (left to right), Z = rows (front to back), Y = up
- **Uneven row alignment**: Left-aligned (simpler, courts start from X=0)
- **Default court spacing**: 1 meter (~3.28 ft) between courts
- **Net rendering**: Plane mesh spanning court width (X-axis) at center, with slight center sag
- **Line rendering**: Thin BoxGeometry meshes (2 inches = 0.0508 m height above surface)
- **Surface textures**: Procedural colors/materials only, no external images
- **Initial camera**: Top-down angled view (45° pitch) looking at facility center

### Homebase Extension Assumptions

- **Pathfinding**: Manhattan routing through aisles (simplest, courts are obstacles)
- **Robot dock**: Bottom-left corner of facility, offset from courts
- **Simulation start**: 8:00 AM, default operating hours 8:00 AM - 10:00 PM
- **Robot speed**: 0.8 m/s navigation, 0.4 m/s cleaning
- **Cleaning time**: ~90 seconds per court (full traversal)
- **Battery**: 100% capacity, drains 0.5% per meter, 3% per court cleaned, recharges 20%/min
- **Cleanliness drop**: 30-60% randomly after use
- **Players**: Capsule geometry (height 1.7m, radius 0.25m) with procedural idle animation
- **Dirty overlay**: Semi-transparent overlay that fades as robot cleans
- **Simulation speed**: 1×, 4×, 10× multipliers
- **Session durations**: 60, 90, 120 minute options
- **Buffer time**: 5, 10, 15 minute options

---

## Features

### Phase 1: Facility Builder (Complete)
1. Grid Picker Component - 10×10 selection
2. Even/Uneven Mode Toggle with per-row sliders
3. PickleballCourt 3D Component with accurate dimensions
4. Facility Layout Engine with configurable spacing
5. Surface Material Selector (4 options)
6. 3D Scene Setup with OrbitControls
7. UI Layout with split panels

### Phase 2: Homebase Management System
1. **App Modes**: Build Facility vs Homebase tabs
2. **State Management**: Zustand store for all simulation state
3. **Simulation Time**: Pausable clock with speed control
4. **Court State Machine**: AVAILABLE_CLEAN → IN_USE → NEEDS_CLEANING → CLEANING
5. **Booking System**: Auto-generation + manual creation/cancellation
6. **Robot System**: Pudu CC1 model, pathfinding, cleaning animation
7. **Player Visualization**: Capsule humans on active courts
8. **Interactive Selection**: Click courts to select, multi-select support
9. **Scheduling UI**: Generator panel + manual controls
10. **Visual Overlays**: Status labels, dirty indicators, notifications
11. **Persistence**: localStorage for layout, bookings, settings

---

## Technical Architecture

### Component Structure
```
App
├── AppHeader (mode tabs, sim clock)
├── BuildMode
│   ├── ControlPanel (GridPicker, UnevenToggle, etc.)
│   └── FacilityCanvas
└── HomebaseMode
    ├── HomebasePanel
    │   ├── SimulationControls
    │   ├── SchedulingPanel
    │   ├── ManualControlPanel
    │   ├── RobotStatusPanel
    │   ├── CleaningQueuePanel
    │   └── SelectedCourtCard
    └── HomebaseCanvas
        ├── InteractiveFacility
        │   ├── SelectableCourt (with overlays)
        │   ├── CourtStatusLabel
        │   └── DirtyOverlay
        ├── CleaningRobotCC1
        ├── PlayerGroup
        └── RobotDock
```

### State Management (Zustand)
```
useFacilityStore
├── config: FacilityConfig
├── surfaceType, spacing, showNet, showLines
└── actions: setConfig, setSurface, etc.

useSimulationStore
├── currentTime: number (minutes since midnight)
├── isPlaying: boolean
├── speed: 1 | 4 | 10
├── courts: Map<courtId, CourtState>
├── bookings: Booking[]
├── cleaningQueue: CleaningJob[]
├── robots: Robot[]
└── actions: tick, addBooking, dispatchRobot, etc.
```

### Data Flow
- App holds mode state (build/homebase)
- Zustand stores manage all simulation state
- useFrame drives simulation tick
- Components subscribe to relevant slices
- All updates are reactive and immediate
