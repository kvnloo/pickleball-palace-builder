import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { GridPicker } from './GridPicker';
import { RowLengthControls } from './RowLengthControls';
import { SurfaceDropdown } from './SurfaceDropdown';
import { FacilityState, SurfaceType } from '@/types/facility';

interface ControlPanelProps {
  state: FacilityState;
  onGridSelect: (rows: number, cols: number) => void;
  onUnevenToggle: (uneven: boolean) => void;
  onRowLengthsChange: (rowLengths: number[]) => void;
  onSurfaceChange: (surface: SurfaceType) => void;
  onSpacingChange: (spacing: number) => void;
  onShowNetChange: (show: boolean) => void;
  onShowLinesChange: (show: boolean) => void;
}

export function ControlPanel({
  state,
  onGridSelect,
  onUnevenToggle,
  onRowLengthsChange,
  onSurfaceChange,
  onSpacingChange,
  onShowNetChange,
  onShowLinesChange,
}: ControlPanelProps) {
  const isUneven = state.config.mode === 'uneven';
  const rows = state.config.rows;
  const cols = state.config.mode === 'even' ? state.config.cols : state.config.maxCols;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 bg-background border-r border-border">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Pickleball Facility Builder
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Design your indoor court layout
        </p>
      </div>

      <Separator />

      <GridPicker onSelect={onGridSelect} />

      {rows > 0 && cols > 0 && (
        <>
          <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
            Current: <span className="font-mono font-medium text-foreground">{cols} × {rows}</span> grid
            {isUneven && ' (uneven)'}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="uneven-toggle" className="text-sm font-medium">
              Uneven Rows
            </Label>
            <Switch
              id="uneven-toggle"
              checked={isUneven}
              onCheckedChange={onUnevenToggle}
            />
          </div>

          {isUneven && state.config.mode === 'uneven' && (
            <RowLengthControls
              rows={rows}
              maxCols={state.config.maxCols}
              rowLengths={state.config.rowLengths}
              onChange={onRowLengthsChange}
            />
          )}

          <Separator />

          <SurfaceDropdown value={state.surfaceType} onChange={onSurfaceChange} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Court Spacing
              </Label>
              <span className="text-xs font-mono text-muted-foreground">
                {state.spacing.toFixed(1)}m
              </span>
            </div>
            <Slider
              value={[state.spacing]}
              min={0.5}
              max={3}
              step={0.1}
              onValueChange={([v]) => onSpacingChange(v)}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-net" className="text-sm">
                Show Nets
              </Label>
              <Switch
                id="show-net"
                checked={state.showNet}
                onCheckedChange={onShowNetChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-lines" className="text-sm">
                Show Lines
              </Label>
              <Switch
                id="show-lines"
                checked={state.showLines}
                onCheckedChange={onShowLinesChange}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
