import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SurfaceType, SURFACE_MATERIALS } from '@/types/facility';

interface SurfaceDropdownProps {
  value: SurfaceType;
  onChange: (value: SurfaceType) => void;
}

export function SurfaceDropdown({ value, onChange }: SurfaceDropdownProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Surface Type
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select surface" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SURFACE_MATERIALS) as SurfaceType[]).map((key) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: SURFACE_MATERIALS[key].color }}
                />
                {SURFACE_MATERIALS[key].name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
