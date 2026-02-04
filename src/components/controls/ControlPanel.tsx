import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { GridPicker } from './GridPicker';
import { RowLengthControls } from './RowLengthControls';
import { SurfaceDropdown } from './SurfaceDropdown';
import { useFacilityStore } from '@/stores/facilityStore';
import { SurfaceType } from '@/types/facility';
import { useCallback } from 'react';

export function ControlPanel() {
  const {
    config,
    surfaceType,
    spacing,
    showNet,
    showLines,
    setConfig,
    setSurfaceType,
    setSpacing,
    setShowNet,
    setShowLines,
  } = useFacilityStore();

  const isUneven = config.mode === 'uneven';
  const rows = config.rows;
  const cols = config.mode === 'even' ? config.cols : config.maxCols;

  const handleGridSelect = useCallback((newRows: number, newCols: number) => {
    if (config.mode === 'even') {
      setConfig({ mode: 'even', rows: newRows, cols: newCols });
    } else {
      setConfig({
        mode: 'uneven',
        rows: newRows,
        maxCols: newCols,
        rowLengths: Array(newRows).fill(newCols),
      });
    }
  }, [config.mode, setConfig]);

  const handleUnevenToggle = useCallback((uneven: boolean) => {
    if (uneven) {
      const newRows = config.rows;
      const newCols = config.mode === 'even' ? config.cols : config.maxCols;
      setConfig({
        mode: 'uneven',
        rows: newRows,
        maxCols: newCols,
        rowLengths: Array(newRows).fill(newCols),
      });
    } else {
      const newRows = config.rows;
      const newCols = config.mode === 'uneven' ? config.maxCols : config.cols;
      setConfig({ mode: 'even', rows: newRows, cols: newCols });
    }
  }, [config, setConfig]);

  const handleRowLengthsChange = useCallback((rowLengths: number[]) => {
    if (config.mode !== 'uneven') return;
    setConfig({ ...config, rowLengths });
  }, [config, setConfig]);

  const handleSurfaceChange = useCallback((surface: SurfaceType) => {
    setSurfaceType(surface);
  }, [setSurfaceType]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 bg-background border-r border-border">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Build Facility
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your court layout
        </p>
      </div>

      <Separator />

      <GridPicker onSelect={handleGridSelect} />

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
              onCheckedChange={handleUnevenToggle}
            />
          </div>

          {isUneven && config.mode === 'uneven' && (
            <RowLengthControls
              rows={rows}
              maxCols={config.maxCols}
              rowLengths={config.rowLengths}
              onChange={handleRowLengthsChange}
            />
          )}

          <Separator />

          <SurfaceDropdown value={surfaceType} onChange={handleSurfaceChange} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Court Spacing
              </Label>
              <span className="text-xs font-mono text-muted-foreground">
                {spacing.toFixed(1)}m
              </span>
            </div>
            <Slider
              value={[spacing]}
              min={0.5}
              max={3}
              step={0.1}
              onValueChange={([v]) => setSpacing(v)}
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
                checked={showNet}
                onCheckedChange={setShowNet}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-lines" className="text-sm">
                Show Lines
              </Label>
              <Switch
                id="show-lines"
                checked={showLines}
                onCheckedChange={setShowLines}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
