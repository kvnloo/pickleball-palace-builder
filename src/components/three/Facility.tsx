import { useMemo } from 'react';
import { PickleballCourt } from './PickleballCourt';
import { FacilityState, COURT_WIDTH, COURT_LENGTH } from '@/types/facility';

interface FacilityProps {
  state: FacilityState;
}

export function Facility({ state }: FacilityProps) {
  // Calculate court positions based on config
  const courtPositions = useMemo(() => {
    const positions: Array<{ x: number; z: number; key: string }> = [];
    const { config, spacing } = state;
    
    const courtWidthWithSpacing = COURT_WIDTH + spacing;
    const courtLengthWithSpacing = COURT_LENGTH + spacing;
    
    const rows = config.rows;
    
    for (let row = 0; row < rows; row++) {
      const cols = config.mode === 'even' 
        ? config.cols 
        : config.rowLengths[row] ?? config.maxCols;
      
      for (let col = 0; col < cols; col++) {
        // Left-aligned: courts start from x=0
        const x = col * courtWidthWithSpacing + COURT_WIDTH / 2;
        const z = row * courtLengthWithSpacing + COURT_LENGTH / 2;
        
        positions.push({ x, z, key: `${row}-${col}` });
      }
    }
    
    return positions;
  }, [state]);

  // Calculate facility bounds for ground plane
  const bounds = useMemo(() => {
    const { config, spacing } = state;
    const rows = config.rows;
    const maxCols = config.mode === 'even' 
      ? config.cols 
      : Math.max(...config.rowLengths, config.maxCols);
    
    const width = maxCols * (COURT_WIDTH + spacing) - spacing + 4; // +4m padding
    const length = rows * (COURT_LENGTH + spacing) - spacing + 4;
    const centerX = (maxCols * (COURT_WIDTH + spacing) - spacing) / 2;
    const centerZ = (rows * (COURT_LENGTH + spacing) - spacing) / 2;
    
    return { width, length, centerX, centerZ };
  }, [state]);

  if (state.config.rows === 0 || 
      (state.config.mode === 'even' && state.config.cols === 0)) {
    return null;
  }

  return (
    <group>
      {/* Ground plane */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[bounds.centerX, -0.02, bounds.centerZ]}
        receiveShadow
      >
        <planeGeometry args={[bounds.width, bounds.length]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} />
      </mesh>

      {/* Courts */}
      {courtPositions.map(({ x, z, key }) => (
        <group key={key} position={[x, 0, z]}>
          <PickleballCourt
            surfaceType={state.surfaceType}
            showNet={state.showNet}
            showLines={state.showLines}
          />
        </group>
      ))}
    </group>
  );
}
