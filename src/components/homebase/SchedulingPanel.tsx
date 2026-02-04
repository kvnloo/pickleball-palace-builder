import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useFacilityStore } from '@/stores/facilityStore';
import { useSimulationStore } from '@/stores/simulationStore';

export function SchedulingPanel() {
  const { config, schedulingSettings, setSchedulingSettings } = useFacilityStore();
  const { generateSchedule, clearBookings, bookings, addNotification } = useSimulationStore();

  const handleGenerate = useCallback(() => {
    const rows = config.rows;
    const cols = config.mode === 'even' ? config.cols : config.maxCols;
    const rowLengths = config.mode === 'uneven' ? config.rowLengths : undefined;

    generateSchedule({
      rows,
      cols,
      rowLengths,
      startTime: schedulingSettings.operatingHoursStart,
      endTime: schedulingSettings.operatingHoursEnd,
      sessionDuration: schedulingSettings.sessionDuration,
      bufferTime: schedulingSettings.bufferTime,
      demandLevel: schedulingSettings.demandLevel,
    });
  }, [config, schedulingSettings, generateSchedule]);

  const handleClear = useCallback(() => {
    clearBookings();
    addNotification('All bookings cleared');
  }, [clearBookings, addNotification]);

  const formatHour = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:00 ${period}`;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Schedule Generator</h3>
      
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Operating Hours</Label>
            <span className="text-xs text-muted-foreground">
              {formatHour(schedulingSettings.operatingHoursStart)} - {formatHour(schedulingSettings.operatingHoursEnd)}
            </span>
          </div>
          <div className="flex gap-2">
            <Select
              value={schedulingSettings.operatingHoursStart.toString()}
              onValueChange={(v) => setSchedulingSettings({ operatingHoursStart: parseInt(v) })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[6, 7, 8, 9, 10].map((h) => (
                  <SelectItem key={h} value={(h * 60).toString()}>{h}:00 AM</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={schedulingSettings.operatingHoursEnd.toString()}
              onValueChange={(v) => setSchedulingSettings({ operatingHoursEnd: parseInt(v) })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[18, 19, 20, 21, 22, 23].map((h) => (
                  <SelectItem key={h} value={(h * 60).toString()}>
                    {h > 12 ? h - 12 : h}:00 PM
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Session Duration</Label>
          <Select
            value={schedulingSettings.sessionDuration.toString()}
            onValueChange={(v) => setSchedulingSettings({ sessionDuration: parseInt(v) as 60 | 90 | 120 })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60 minutes</SelectItem>
              <SelectItem value="90">90 minutes</SelectItem>
              <SelectItem value="120">120 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Buffer Time</Label>
          <Select
            value={schedulingSettings.bufferTime.toString()}
            onValueChange={(v) => setSchedulingSettings({ bufferTime: parseInt(v) as 5 | 10 | 15 })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="10">10 minutes</SelectItem>
              <SelectItem value="15">15 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Demand Level</Label>
          <Select
            value={schedulingSettings.demandLevel}
            onValueChange={(v) => setSchedulingSettings({ demandLevel: v as 'light' | 'normal' | 'peak' })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light (~40% capacity)</SelectItem>
              <SelectItem value="normal">Normal (~65% capacity)</SelectItem>
              <SelectItem value="peak">Peak (~85% capacity)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="clean-after" className="text-xs">Clean After Session</Label>
          <Switch
            id="clean-after"
            checked={schedulingSettings.cleanAfterSession}
            onCheckedChange={(v) => setSchedulingSettings({ cleanAfterSession: v })}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Button onClick={handleGenerate} size="sm" className="w-full">
          Generate Today's Schedule
        </Button>
        <Button onClick={handleClear} variant="outline" size="sm" className="w-full">
          Clear All Bookings
        </Button>
        <div className="text-xs text-muted-foreground text-center">
          {bookings.length} bookings scheduled
        </div>
      </div>
    </div>
  );
}
