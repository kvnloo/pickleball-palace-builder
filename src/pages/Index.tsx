import { useState, useCallback } from 'react';
import { ControlPanel } from '@/components/controls/ControlPanel';
import { FacilityCanvas } from '@/components/three/FacilityCanvas';
import { FacilityState, SurfaceType } from '@/types/facility';

const initialState: FacilityState = {
  config: {
    mode: 'even',
    rows: 2,
    cols: 3,
  },
  surfaceType: 'polypropylene',
  spacing: 1,
  showNet: true,
  showLines: true,
};

const Index = () => {
  const [state, setState] = useState<FacilityState>(initialState);

  const handleGridSelect = useCallback((rows: number, cols: number) => {
    setState(prev => {
      if (prev.config.mode === 'even') {
        return {
          ...prev,
          config: { mode: 'even', rows, cols },
        };
      } else {
        // In uneven mode, cols becomes maxCols, reset rowLengths
        return {
          ...prev,
          config: {
            mode: 'uneven',
            rows,
            maxCols: cols,
            rowLengths: Array(rows).fill(cols),
          },
        };
      }
    });
  }, []);

  const handleUnevenToggle = useCallback((uneven: boolean) => {
    setState(prev => {
      if (uneven) {
        const rows = prev.config.rows;
        const cols = prev.config.mode === 'even' ? prev.config.cols : prev.config.maxCols;
        return {
          ...prev,
          config: {
            mode: 'uneven',
            rows,
            maxCols: cols,
            rowLengths: Array(rows).fill(cols),
          },
        };
      } else {
        const rows = prev.config.rows;
        const cols = prev.config.mode === 'uneven' ? prev.config.maxCols : prev.config.cols;
        return {
          ...prev,
          config: { mode: 'even', rows, cols },
        };
      }
    });
  }, []);

  const handleRowLengthsChange = useCallback((rowLengths: number[]) => {
    setState(prev => {
      if (prev.config.mode !== 'uneven') return prev;
      return {
        ...prev,
        config: {
          ...prev.config,
          rowLengths,
        },
      };
    });
  }, []);

  const handleSurfaceChange = useCallback((surfaceType: SurfaceType) => {
    setState(prev => ({ ...prev, surfaceType }));
  }, []);

  const handleSpacingChange = useCallback((spacing: number) => {
    setState(prev => ({ ...prev, spacing }));
  }, []);

  const handleShowNetChange = useCallback((showNet: boolean) => {
    setState(prev => ({ ...prev, showNet }));
  }, []);

  const handleShowLinesChange = useCallback((showLines: boolean) => {
    setState(prev => ({ ...prev, showLines }));
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left panel: Controls */}
      <div className="w-80 flex-shrink-0">
        <ControlPanel
          state={state}
          onGridSelect={handleGridSelect}
          onUnevenToggle={handleUnevenToggle}
          onRowLengthsChange={handleRowLengthsChange}
          onSurfaceChange={handleSurfaceChange}
          onSpacingChange={handleSpacingChange}
          onShowNetChange={handleShowNetChange}
          onShowLinesChange={handleShowLinesChange}
        />
      </div>

      {/* Right panel: 3D Canvas */}
      <div className="flex-1">
        <FacilityCanvas state={state} />
      </div>
    </div>
  );
};

export default Index;
