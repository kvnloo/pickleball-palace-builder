import { useSimulationStore } from '@/stores/simulationStore';
import { formatTime } from '@/types/facility';

export function CleaningQueuePanel() {
  const { cleaningQueue, currentTime } = useSimulationStore();

  if (cleaningQueue.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Cleaning Queue</h3>
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md text-center">
          No courts waiting for cleaning
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Cleaning Queue</h3>
        <span className="text-xs text-muted-foreground">{cleaningQueue.length} pending</span>
      </div>
      
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {cleaningQueue.map((job, index) => {
          const waitTime = Math.round(currentTime - job.createdAt);
          const courtLabel = job.courtId.split('-').slice(1).map(n => parseInt(n) + 1).join('-');
          
          return (
            <div
              key={job.id}
              className={`flex items-center justify-between text-xs bg-muted/30 px-2 py-1.5 rounded ${
                job.priority === 'high' ? 'border-l-2 border-orange-500' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-4">#{index + 1}</span>
                <span>Court {courtLabel}</span>
                {job.priority === 'high' && (
                  <span className="text-[10px] px-1 py-0.5 bg-orange-500/20 text-orange-500 rounded">
                    Priority
                  </span>
                )}
              </div>
              <span className="text-muted-foreground">
                {waitTime > 0 ? `${waitTime}m wait` : 'Just added'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
