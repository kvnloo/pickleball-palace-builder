import { Button } from '@/components/ui/button';
import { Play, Pause, FastForward } from 'lucide-react';
import { useSimulationStore } from '@/stores/simulationStore';
import { formatTime } from '@/types/facility';

export function SimulationControls() {
  const { currentTime, isPlaying, speed, togglePlaying, setSpeed } = useSimulationStore();

  return (
    <div className="flex items-center gap-3 bg-muted/50 px-3 py-2 rounded-lg">
      <div className="font-mono text-lg font-bold text-foreground min-w-[90px]">
        {formatTime(Math.floor(currentTime))}
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant={isPlaying ? "default" : "secondary"}
          size="icon"
          className="h-8 w-8"
          onClick={togglePlaying}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <div className="flex gap-0.5 ml-1">
          {([1, 4, 10] as const).map((s) => (
            <Button
              key={s}
              variant={speed === s ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSpeed(s)}
            >
              {s}×
            </Button>
          ))}
        </div>
      </div>

      <div className={`text-xs px-2 py-1 rounded ${isPlaying ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
        {isPlaying ? 'Running' : 'Paused'}
      </div>
    </div>
  );
}
