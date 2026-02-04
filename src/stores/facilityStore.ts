import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  FacilityConfig, 
  SurfaceType, 
  AppMode,
  SchedulingSettings,
  RobotSettings,
} from '@/types/facility';

interface FacilityStore {
  // App mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // Facility config
  config: FacilityConfig;
  surfaceType: SurfaceType;
  spacing: number;
  showNet: boolean;
  showLines: boolean;

  // Actions
  setConfig: (config: FacilityConfig) => void;
  setSurfaceType: (type: SurfaceType) => void;
  setSpacing: (spacing: number) => void;
  setShowNet: (show: boolean) => void;
  setShowLines: (show: boolean) => void;

  // Scheduling settings
  schedulingSettings: SchedulingSettings;
  setSchedulingSettings: (settings: Partial<SchedulingSettings>) => void;

  // Robot settings
  robotSettings: RobotSettings;
  setRobotSettings: (settings: Partial<RobotSettings>) => void;
}

const defaultSchedulingSettings: SchedulingSettings = {
  operatingHoursStart: 480, // 8:00 AM
  operatingHoursEnd: 1320,  // 10:00 PM
  sessionDuration: 60,
  bufferTime: 10,
  cleanAfterSession: true,
  demandLevel: 'normal',
};

const defaultRobotSettings: RobotSettings = {
  navigationSpeed: 0.8,
  cleaningSpeed: 0.4,
  cleaningTimePerCourt: 90,
  batteryDrainPerMeter: 0.5,
  batteryDrainPerCourt: 3,
  rechargeRatePerMinute: 20,
};

export const useFacilityStore = create<FacilityStore>()(
  persist(
    (set) => ({
      mode: 'build',
      setMode: (mode) => set({ mode }),

      config: { mode: 'even', rows: 2, cols: 3 },
      surfaceType: 'polypropylene',
      spacing: 1,
      showNet: true,
      showLines: true,

      setConfig: (config) => set({ config }),
      setSurfaceType: (surfaceType) => set({ surfaceType }),
      setSpacing: (spacing) => set({ spacing }),
      setShowNet: (showNet) => set({ showNet }),
      setShowLines: (showLines) => set({ showLines }),

      schedulingSettings: defaultSchedulingSettings,
      setSchedulingSettings: (settings) => 
        set((state) => ({
          schedulingSettings: { ...state.schedulingSettings, ...settings },
        })),

      robotSettings: defaultRobotSettings,
      setRobotSettings: (settings) =>
        set((state) => ({
          robotSettings: { ...state.robotSettings, ...settings },
        })),
    }),
    {
      name: 'facility-storage',
      partialize: (state) => ({
        config: state.config,
        surfaceType: state.surfaceType,
        spacing: state.spacing,
        showNet: state.showNet,
        showLines: state.showLines,
        schedulingSettings: state.schedulingSettings,
        robotSettings: state.robotSettings,
      }),
    }
  )
);
