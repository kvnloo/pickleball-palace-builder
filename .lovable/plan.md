

## Assumptions

- **Unit system**: Using meters internally (1 ft = 0.3048 m) for Three.js consistency
- **Axis system**: X = columns (left to right), Z = rows (front to back), Y = up
- **Uneven row alignment**: Left-aligned (simpler, courts start from X=0)
- **Default court spacing**: 1 meter (~3.28 ft) between courts
- **Net rendering**: Simple plane mesh with slight sag approximation (lower in center)
- **Line rendering**: Thin BoxGeometry meshes (2 inches = 0.0508 m height above surface)
- **Surface textures**: Procedural colors/materials only, no external images
- **Initial camera**: Top-down angled view (45° pitch) looking at facility center

---

## Features

### 1. Grid Picker Component
- Interactive grid of small squares (max 10×10)
- Hover highlights rectangular selection from (1,1) to current cell
- Live "Cols × Rows" label updates on hover
- Click commits selection and triggers facility generation

### 2. Even/Uneven Mode Toggle
- **Even mode**: Simple grid with uniform rows × cols
- **Uneven mode**: After grid selection, shows per-row sliders (1 to maxCols)
- Data model updates in real-time, 3D view responds immediately

### 3. PickleballCourt 3D Component
- Accurate regulation dimensions:
  - 20 ft × 44 ft playing surface
  - 7 ft kitchen zones on each side of net
  - Centerline dividing service courts
  - 2-inch wide line markings as mesh geometry
- Net with 36" height at sides, 34" at center
- Memoized geometries and materials for performance
- Props: `surfaceType`, `showNet`, `showLines`

### 4. Facility Layout Engine
- Positions courts in grid based on data model
- Configurable spacing between courts
- Left-aligns uneven rows
- Updates dynamically as controls change

### 5. Surface Material Selector
- Dropdown with 4 options:
  - Hardwood (maple gym) - warm brown, low roughness
  - Rubber sports floor - dark gray, medium roughness
  - Polypropylene tiles - bright blue, slight texture
  - Vinyl/PU flooring - light gray-blue, smooth
- Materials use color + roughness + metalness for visual distinction

### 6. 3D Scene Setup
- OrbitControls for camera manipulation
- Ambient + directional lighting
- Auto-adjusting camera to frame the facility
- Optional: ground plane extending beyond courts

### 7. UI Layout
- Split view: left panel (controls) + right panel (3D canvas)
- Clean, minimal CSS styling
- Responsive controls that update 3D in real-time

---

## Technical Architecture

### Component Structure
```
App
├── ControlPanel
│   ├── GridPicker
│   ├── UnevenToggle
│   ├── RowLengthControls (conditional)
│   ├── SpacingSlider
│   └── SurfaceDropdown
└── FacilityCanvas
    ├── Lighting
    ├── Controls (OrbitControls)
    └── Facility
        └── PickleballCourt (multiple instances)
```

### Data Flow
- App holds facility config state
- ControlPanel updates state via callbacks
- FacilityCanvas reads state and renders courts
- All updates are reactive and immediate

