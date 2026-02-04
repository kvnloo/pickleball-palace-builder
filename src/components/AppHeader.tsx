import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useFacilityStore } from '@/stores/facilityStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { AppMode } from '@/types/facility';
import { Settings, Home, Download, Upload } from 'lucide-react';

export function AppHeader() {
  const { mode, setMode } = useFacilityStore();
  const { exportState, importState } = useSimulationStore();

  const handleModeChange = useCallback((newMode: AppMode) => {
    setMode(newMode);
  }, [setMode]);

  const handleExport = useCallback(() => {
    const data = exportState();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'facility-schedule.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportState]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          importState(text);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [importState]);

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">PB</span>
        </div>
        <span className="font-semibold text-foreground">Pickleball Facility Manager</span>
      </div>

      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
        <Button
          variant={mode === 'build' ? 'default' : 'ghost'}
          size="sm"
          className="gap-2"
          onClick={() => handleModeChange('build')}
        >
          <Settings className="h-4 w-4" />
          Build
        </Button>
        <Button
          variant={mode === 'homebase' ? 'default' : 'ghost'}
          size="sm"
          className="gap-2"
          onClick={() => handleModeChange('homebase')}
        >
          <Home className="h-4 w-4" />
          Homebase
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport} title="Export schedule">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleImport} title="Import schedule">
          <Upload className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
