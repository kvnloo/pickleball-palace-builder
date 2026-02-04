import { Slider } from '@/components/ui/slider';

interface RowLengthControlsProps {
  rows: number;
  maxCols: number;
  rowLengths: number[];
  onChange: (rowLengths: number[]) => void;
}

export function RowLengthControls({ rows, maxCols, rowLengths, onChange }: RowLengthControlsProps) {
  const handleRowChange = (rowIndex: number, value: number[]) => {
    const newLengths = [...rowLengths];
    newLengths[rowIndex] = value[0];
    onChange(newLengths);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-foreground">
        Courts Per Row
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-14">
              Row {idx + 1}:
            </span>
            <Slider
              value={[rowLengths[idx] ?? maxCols]}
              min={1}
              max={maxCols}
              step={1}
              onValueChange={(value) => handleRowChange(idx, value)}
              className="flex-1"
            />
            <span className="text-xs font-mono text-foreground w-4 text-right">
              {rowLengths[idx] ?? maxCols}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
