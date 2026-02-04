import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { CourtState, getStatusLabel, getStatusColor } from '@/types/facility';

interface CourtStatusLabelProps {
  courtState: CourtState;
  position: { x: number; z: number };
}

export function CourtStatusLabel({ courtState, position }: CourtStatusLabelProps) {
  const statusColor = getStatusColor(courtState.status);
  const statusLabel = getStatusLabel(courtState.status);
  
  const courtLabel = useMemo(() => {
    return `${courtState.row + 1}-${courtState.col + 1}`;
  }, [courtState.row, courtState.col]);

  return (
    <Html
      position={[position.x, 1.5, position.z]}
      center
      distanceFactor={15}
      style={{ pointerEvents: 'none' }}
    >
      <div className="flex flex-col items-center gap-1 select-none">
        <div className="bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md border border-border shadow-lg">
          <div className="text-xs font-bold text-foreground">Court {courtLabel}</div>
        </div>
        <div
          className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
          style={{ backgroundColor: statusColor }}
        >
          {statusLabel}
        </div>
        {courtState.cleanliness < 100 && (
          <div className="bg-background/80 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
            {Math.round(courtState.cleanliness)}% clean
          </div>
        )}
      </div>
    </Html>
  );
}
