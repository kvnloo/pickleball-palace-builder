import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSimulationStore } from '@/stores/simulationStore';
import { getStatusLabel, getStatusColor } from '@/types/facility';

export function ManualControlPanel() {
  const {
    selectedCourtIds,
    courts,
    multiSelectMode,
    toggleMultiSelectMode,
    dispatchRobot,
    forceClean,
    forceEndSession,
    setCourtOutOfService,
  } = useSimulationStore();

  const selectedCourts = Array.from(selectedCourtIds).map((id) => courts.get(id)).filter(Boolean);
  const hasSelection = selectedCourts.length > 0;

  const handleDispatchRobot = useCallback(() => {
    selectedCourtIds.forEach((id) => dispatchRobot(id));
  }, [selectedCourtIds, dispatchRobot]);

  const handleForceClean = useCallback(() => {
    selectedCourtIds.forEach((id) => forceClean(id));
  }, [selectedCourtIds, forceClean]);

  const handleForceEndSession = useCallback(() => {
    selectedCourtIds.forEach((id) => forceEndSession(id));
  }, [selectedCourtIds, forceEndSession]);

  const handleToggleService = useCallback((outOfService: boolean) => {
    selectedCourtIds.forEach((id) => setCourtOutOfService(id, outOfService));
  }, [selectedCourtIds, setCourtOutOfService]);

  const canEndSession = selectedCourts.some((c) => c?.status === 'IN_USE');
  const canClean = selectedCourts.some((c) => c?.status === 'NEEDS_CLEANING' || (c?.status === 'AVAILABLE_CLEAN' && c.cleanliness < 100));
  const canDispatch = selectedCourts.some((c) => c?.status === 'NEEDS_CLEANING');
  const allOutOfService = selectedCourts.every((c) => c?.status === 'OUT_OF_SERVICE');
  const noneInUse = selectedCourts.every((c) => c?.status !== 'IN_USE');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Manual Controls</h3>
        <div className="flex items-center gap-2">
          <Label htmlFor="multi-select" className="text-xs text-muted-foreground">Multi</Label>
          <Switch
            id="multi-select"
            checked={multiSelectMode}
            onCheckedChange={toggleMultiSelectMode}
          />
        </div>
      </div>

      {!hasSelection ? (
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
          Click on a court to select it. Hold Shift/Ctrl for multi-select.
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {selectedCourts.length} court{selectedCourts.length !== 1 ? 's' : ''} selected
          </div>

          <div className="space-y-1">
            {selectedCourts.slice(0, 4).map((court) => (
              <div
                key={court!.id}
                className="flex items-center justify-between text-xs bg-muted/30 px-2 py-1 rounded"
              >
                <span>Court {court!.row + 1}-{court!.col + 1}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-white text-[10px]"
                  style={{ backgroundColor: getStatusColor(court!.status) }}
                >
                  {getStatusLabel(court!.status)}
                </span>
              </div>
            ))}
            {selectedCourts.length > 4 && (
              <div className="text-xs text-muted-foreground text-center">
                +{selectedCourts.length - 4} more
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Button
              onClick={handleForceEndSession}
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={!canEndSession}
            >
              End Session Now
            </Button>
            
            <Button
              onClick={handleDispatchRobot}
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={!canDispatch}
            >
              Dispatch Robot (Priority)
            </Button>
            
            <Button
              onClick={handleForceClean}
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={!canClean}
            >
              Mark as Cleaned
            </Button>

            <Separator />

            {allOutOfService ? (
              <Button
                onClick={() => handleToggleService(false)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Restore Service
              </Button>
            ) : (
              <Button
                onClick={() => handleToggleService(true)}
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={!noneInUse}
              >
                Mark Out of Service
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
