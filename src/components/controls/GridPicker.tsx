import { useState, useCallback } from 'react';

interface GridPickerProps {
  maxRows?: number;
  maxCols?: number;
  onSelect: (rows: number, cols: number) => void;
}

export function GridPicker({ maxRows = 10, maxCols = 10, onSelect }: GridPickerProps) {
  const [hoverPos, setHoverPos] = useState<{ row: number; col: number } | null>(null);

  const handleMouseEnter = useCallback((row: number, col: number) => {
    setHoverPos({ row, col });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverPos(null);
  }, []);

  const handleClick = useCallback(() => {
    if (hoverPos) {
      onSelect(hoverPos.row, hoverPos.col);
    }
  }, [hoverPos, onSelect]);

  const isHighlighted = (row: number, col: number) => {
    if (!hoverPos) return false;
    return row <= hoverPos.row && col <= hoverPos.col;
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">
        Select Grid Size
      </div>
      <div 
        className="inline-grid gap-1 p-2 bg-muted/50 rounded-lg border border-border"
        style={{ 
          gridTemplateColumns: `repeat(${maxCols}, 1fr)`,
        }}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {Array.from({ length: maxRows }, (_, rowIdx) =>
          Array.from({ length: maxCols }, (_, colIdx) => {
            const row = rowIdx + 1;
            const col = colIdx + 1;
            const highlighted = isHighlighted(row, col);
            
            return (
              <div
                key={`${row}-${col}`}
                className={`
                  w-5 h-5 rounded-sm border cursor-pointer transition-colors
                  ${highlighted 
                    ? 'bg-primary border-primary' 
                    : 'bg-background border-border hover:border-primary/50'
                  }
                `}
                onMouseEnter={() => handleMouseEnter(row, col)}
              />
            );
          })
        )}
      </div>
      <div className="text-sm text-muted-foreground h-5">
        {hoverPos ? (
          <span className="font-mono">
            {hoverPos.col} × {hoverPos.row} courts
          </span>
        ) : (
          <span>Hover to select</span>
        )}
      </div>
    </div>
  );
}
