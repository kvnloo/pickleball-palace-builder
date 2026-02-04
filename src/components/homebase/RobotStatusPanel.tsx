import { useSimulationStore } from '@/stores/simulationStore';

export function RobotStatusPanel() {
  const { robots } = useSimulationStore();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-gray-500';
      case 'navigating': return 'bg-blue-500';
      case 'cleaning': return 'bg-purple-500';
      case 'returning': return 'bg-yellow-500';
      case 'charging': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Robot Fleet</h3>
      
      <div className="space-y-2">
        {robots.map((robot) => (
          <div
            key={robot.id}
            className="bg-muted/30 rounded-md p-2 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{robot.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded text-white ${getStatusColor(robot.status)}`}
              >
                {getStatusLabel(robot.status)}
              </span>
            </div>
            
            {/* Battery bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Battery</span>
                <span>{Math.round(robot.battery)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    robot.battery > 60 ? 'bg-green-500' :
                    robot.battery > 30 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${robot.battery}%` }}
                />
              </div>
            </div>

            {/* Target court */}
            {robot.targetCourtId && (
              <div className="text-[10px] text-muted-foreground">
                Target: Court {robot.targetCourtId.split('-').slice(1).map(n => parseInt(n) + 1).join('-')}
              </div>
            )}

            {/* Cleaning progress */}
            {robot.status === 'cleaning' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Cleaning</span>
                  <span>{Math.round(robot.cleaningProgress)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${robot.cleaningProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
