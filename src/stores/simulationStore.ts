import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CourtState,
  CourtStatus,
  Booking,
  CleaningJob,
  Robot,
  getCourtId,
  COURT_WIDTH,
  COURT_LENGTH,
} from '@/types/facility';

type SimulationSpeed = 1 | 4 | 10;

interface SimulationStore {
  // Time
  currentTime: number; // minutes since midnight
  isPlaying: boolean;
  speed: SimulationSpeed;

  // State
  courts: Map<string, CourtState>;
  bookings: Booking[];
  cleaningQueue: CleaningJob[];
  robots: Robot[];
  selectedCourtIds: Set<string>;
  multiSelectMode: boolean;

  // Dock position
  dockPosition: { x: number; z: number };

  // Notifications
  notifications: Array<{ id: string; message: string; timestamp: number }>;

  // Actions - Time
  setCurrentTime: (time: number) => void;
  togglePlaying: () => void;
  setSpeed: (speed: SimulationSpeed) => void;
  tick: (deltaMinutes: number) => void;

  // Actions - Courts
  initializeCourts: (rows: number, cols: number, rowLengths?: number[]) => void;
  setCourtStatus: (courtId: string, status: CourtStatus) => void;
  updateCourtCleanliness: (courtId: string, cleanliness: number) => void;
  setCourtOutOfService: (courtId: string, outOfService: boolean) => void;

  // Actions - Selection
  selectCourt: (courtId: string) => void;
  deselectCourt: (courtId: string) => void;
  clearSelection: () => void;
  toggleMultiSelectMode: () => void;

  // Actions - Bookings
  addBooking: (booking: Omit<Booking, 'id'>) => void;
  removeBooking: (bookingId: string) => void;
  clearBookings: () => void;
  generateSchedule: (settings: {
    rows: number;
    cols: number;
    rowLengths?: number[];
    startTime: number;
    endTime: number;
    sessionDuration: number;
    bufferTime: number;
    demandLevel: 'light' | 'normal' | 'peak';
  }) => void;

  // Actions - Cleaning
  enqueueCleaningJob: (courtId: string, priority?: 'normal' | 'high') => void;
  dequeueCleaningJob: (jobId: string) => void;
  dispatchRobot: (courtId: string) => void;
  forceClean: (courtId: string) => void;
  forceEndSession: (courtId: string) => void;

  // Actions - Robot
  updateRobot: (robotId: string, updates: Partial<Robot>) => void;
  returnRobotToDock: (robotId: string) => void;

  // Actions - Notifications
  addNotification: (message: string) => void;
  clearNotifications: () => void;

  // Actions - Persistence
  exportState: () => string;
  importState: (json: string) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useSimulationStore = create<SimulationStore>()(
  persist(
    (set, get) => ({
      currentTime: 480, // 8:00 AM
      isPlaying: false,
      speed: 1,

      courts: new Map(),
      bookings: [],
      cleaningQueue: [],
      robots: [
        {
          id: 'robot-1',
          name: 'CC1-Alpha',
          status: 'idle',
          battery: 100,
          position: { x: -2, z: -2 },
          targetCourtId: null,
          currentJobId: null,
          cleaningProgress: 0,
        },
      ],
      selectedCourtIds: new Set(),
      multiSelectMode: false,
      dockPosition: { x: -2, z: -2 },
      notifications: [],

      setCurrentTime: (time) => set({ currentTime: time }),
      togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
      setSpeed: (speed) => set({ speed }),

      tick: (deltaMinutes) => {
        const state = get();
        const newTime = state.currentTime + deltaMinutes;

        // Check bookings starting
        state.bookings.forEach((booking) => {
          const court = state.courts.get(booking.courtId);
          if (!court) return;

          // Start booking
          if (
            state.currentTime < booking.startTime &&
            newTime >= booking.startTime &&
            court.status === 'AVAILABLE_CLEAN'
          ) {
            set((s) => {
              const courts = new Map(s.courts);
              const c = courts.get(booking.courtId);
              if (c) {
                courts.set(booking.courtId, {
                  ...c,
                  status: 'IN_USE',
                  activeBookingId: booking.id,
                });
              }
              return { courts };
            });
            get().addNotification(`Court ${booking.courtId.split('-').slice(1).join('-')} session started`);
          }

          // End booking
          if (
            state.currentTime < booking.endTime &&
            newTime >= booking.endTime &&
            court.status === 'IN_USE' &&
            court.activeBookingId === booking.id
          ) {
            const cleanlinessDropAmount = 30 + Math.random() * 30;
            set((s) => {
              const courts = new Map(s.courts);
              const c = courts.get(booking.courtId);
              if (c) {
                courts.set(booking.courtId, {
                  ...c,
                  status: 'NEEDS_CLEANING',
                  activeBookingId: null,
                  cleanliness: Math.max(0, c.cleanliness - cleanlinessDropAmount),
                  lastUsedAt: newTime,
                });
              }
              return { courts };
            });
            get().addNotification(`Court ${booking.courtId.split('-').slice(1).join('-')} needs cleaning`);
            get().enqueueCleaningJob(booking.courtId);
          }
        });

        set({ currentTime: newTime });
      },

      initializeCourts: (rows, cols, rowLengths) => {
        const courts = new Map<string, CourtState>();
        for (let row = 0; row < rows; row++) {
          const colCount = rowLengths ? rowLengths[row] : cols;
          for (let col = 0; col < colCount; col++) {
            const id = getCourtId(row, col);
            courts.set(id, {
              id,
              row,
              col,
              status: 'AVAILABLE_CLEAN',
              cleanliness: 100,
              lastUsedAt: null,
              lastCleanedAt: null,
              activeBookingId: null,
            });
          }
        }
        set({ courts });
      },

      setCourtStatus: (courtId, status) => {
        set((s) => {
          const courts = new Map(s.courts);
          const court = courts.get(courtId);
          if (court) {
            courts.set(courtId, { ...court, status });
          }
          return { courts };
        });
      },

      updateCourtCleanliness: (courtId, cleanliness) => {
        set((s) => {
          const courts = new Map(s.courts);
          const court = courts.get(courtId);
          if (court) {
            courts.set(courtId, { ...court, cleanliness: Math.min(100, Math.max(0, cleanliness)) });
          }
          return { courts };
        });
      },

      setCourtOutOfService: (courtId, outOfService) => {
        set((s) => {
          const courts = new Map(s.courts);
          const court = courts.get(courtId);
          if (court && court.status !== 'IN_USE') {
            courts.set(courtId, {
              ...court,
              status: outOfService ? 'OUT_OF_SERVICE' : 'AVAILABLE_CLEAN',
            });
          }
          return { courts };
        });
      },

      selectCourt: (courtId) => {
        set((s) => {
          const selected = new Set(s.selectedCourtIds);
          if (!s.multiSelectMode) {
            selected.clear();
          }
          selected.add(courtId);
          return { selectedCourtIds: selected };
        });
      },

      deselectCourt: (courtId) => {
        set((s) => {
          const selected = new Set(s.selectedCourtIds);
          selected.delete(courtId);
          return { selectedCourtIds: selected };
        });
      },

      clearSelection: () => set({ selectedCourtIds: new Set() }),

      toggleMultiSelectMode: () => set((s) => ({ multiSelectMode: !s.multiSelectMode })),

      addBooking: (booking) => {
        const id = generateId();
        set((s) => ({
          bookings: [...s.bookings, { ...booking, id }],
        }));
      },

      removeBooking: (bookingId) => {
        set((s) => ({
          bookings: s.bookings.filter((b) => b.id !== bookingId),
        }));
      },

      clearBookings: () => set({ bookings: [] }),

      generateSchedule: (settings) => {
        const { startTime, endTime, sessionDuration, bufferTime, demandLevel, rows, cols, rowLengths } = settings;
        const newBookings: Booking[] = [];
        
        // Get all court IDs
        const courtIds: string[] = [];
        for (let row = 0; row < rows; row++) {
          const colCount = rowLengths ? rowLengths[row] : cols;
          for (let col = 0; col < colCount; col++) {
            courtIds.push(getCourtId(row, col));
          }
        }

        // Demand affects fill percentage
        const fillPercentage = demandLevel === 'light' ? 0.4 : demandLevel === 'normal' ? 0.65 : 0.85;
        const slotDuration = sessionDuration + bufferTime;
        const totalSlots = Math.floor((endTime - startTime) / slotDuration);

        courtIds.forEach((courtId) => {
          let currentStart = startTime;
          for (let slot = 0; slot < totalSlots; slot++) {
            if (Math.random() < fillPercentage) {
              const types: Array<'open_play' | 'lesson' | 'reservation'> = ['open_play', 'lesson', 'reservation'];
              const type = types[Math.floor(Math.random() * types.length)];
              const playerCount: 2 | 4 = Math.random() > 0.5 ? 4 : 2;
              
              newBookings.push({
                id: generateId(),
                courtId,
                startTime: currentStart,
                endTime: currentStart + sessionDuration,
                type,
                playerCount,
                title: type === 'open_play' ? 'Open Play' : type === 'lesson' ? 'Lesson' : 'Reservation',
              });
            }
            currentStart += slotDuration;
          }
        });

        set({ bookings: newBookings });
        get().addNotification(`Generated ${newBookings.length} bookings`);
      },

      enqueueCleaningJob: (courtId, priority = 'normal') => {
        const existing = get().cleaningQueue.find((j) => j.courtId === courtId);
        if (existing) return;

        const job: CleaningJob = {
          id: generateId(),
          courtId,
          priority,
          createdAt: get().currentTime,
          assignedRobotId: null,
        };
        set((s) => ({
          cleaningQueue: [...s.cleaningQueue, job].sort((a, b) => {
            if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
            return a.createdAt - b.createdAt;
          }),
        }));
      },

      dequeueCleaningJob: (jobId) => {
        set((s) => ({
          cleaningQueue: s.cleaningQueue.filter((j) => j.id !== jobId),
        }));
      },

      dispatchRobot: (courtId) => {
        get().enqueueCleaningJob(courtId, 'high');
        get().addNotification(`Priority cleaning dispatched to Court ${courtId.split('-').slice(1).join('-')}`);
      },

      forceClean: (courtId) => {
        set((s) => {
          const courts = new Map(s.courts);
          const court = courts.get(courtId);
          if (court && court.status !== 'IN_USE') {
            courts.set(courtId, {
              ...court,
              status: 'AVAILABLE_CLEAN',
              cleanliness: 100,
              lastCleanedAt: s.currentTime,
            });
          }
          return { 
            courts,
            cleaningQueue: s.cleaningQueue.filter((j) => j.courtId !== courtId),
          };
        });
        get().addNotification(`Court ${courtId.split('-').slice(1).join('-')} marked as cleaned`);
      },

      forceEndSession: (courtId) => {
        const state = get();
        const court = state.courts.get(courtId);
        if (!court || court.status !== 'IN_USE') return;

        set((s) => {
          const courts = new Map(s.courts);
          courts.set(courtId, {
            ...court,
            status: 'NEEDS_CLEANING',
            activeBookingId: null,
            cleanliness: Math.max(0, court.cleanliness - 40),
            lastUsedAt: s.currentTime,
          });
          return { courts };
        });
        get().enqueueCleaningJob(courtId);
        get().addNotification(`Session ended early on Court ${courtId.split('-').slice(1).join('-')}`);
      },

      updateRobot: (robotId, updates) => {
        set((s) => ({
          robots: s.robots.map((r) => (r.id === robotId ? { ...r, ...updates } : r)),
        }));
      },

      returnRobotToDock: (robotId) => {
        const dock = get().dockPosition;
        set((s) => ({
          robots: s.robots.map((r) =>
            r.id === robotId
              ? { ...r, status: 'returning', targetCourtId: null }
              : r
          ),
        }));
      },

      addNotification: (message) => {
        const id = generateId();
        set((s) => ({
          notifications: [{ id, message, timestamp: Date.now() }, ...s.notifications].slice(0, 10),
        }));
      },

      clearNotifications: () => set({ notifications: [] }),

      exportState: () => {
        const state = get();
        return JSON.stringify({
          currentTime: state.currentTime,
          bookings: state.bookings,
          courts: Array.from(state.courts.entries()),
          cleaningQueue: state.cleaningQueue,
        });
      },

      importState: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            currentTime: data.currentTime || 480,
            bookings: data.bookings || [],
            courts: new Map(data.courts || []),
            cleaningQueue: data.cleaningQueue || [],
          });
        } catch (e) {
          console.error('Failed to import state:', e);
        }
      },
    }),
    {
      name: 'simulation-storage',
      partialize: (state) => ({
        bookings: state.bookings,
        currentTime: state.currentTime,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            ...data,
            state: {
              ...data.state,
              courts: new Map(),
              selectedCourtIds: new Set(),
              cleaningQueue: [],
              notifications: [],
            },
          };
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
