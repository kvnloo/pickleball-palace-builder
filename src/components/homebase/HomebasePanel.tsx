import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SimulationControls } from './SimulationControls';
import { SchedulingPanel } from './SchedulingPanel';
import { ManualControlPanel } from './ManualControlPanel';
import { RobotStatusPanel } from './RobotStatusPanel';
import { CleaningQueuePanel } from './CleaningQueuePanel';
import { NotificationPanel } from './NotificationPanel';

export function HomebasePanel() {
  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">Homebase</h1>
        <p className="text-sm text-muted-foreground">Facility Management</p>
      </div>

      <div className="p-4 border-b border-border">
        <SimulationControls />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <ManualControlPanel />
          
          <Separator />
          
          <RobotStatusPanel />
          
          <Separator />
          
          <CleaningQueuePanel />
          
          <Separator />
          
          <SchedulingPanel />
          
          <Separator />
          
          <NotificationPanel />
        </div>
      </ScrollArea>
    </div>
  );
}
