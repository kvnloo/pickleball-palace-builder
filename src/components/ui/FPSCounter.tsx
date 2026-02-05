 import { usePerformanceStore } from '@/stores/performanceStore';
 
 export function FPSCounter() {
   const { 
     showFpsCounter, 
     currentFps, 
     avgFps, 
     minFps, 
     maxFps, 
     p1Low,
     tier,
     isBenchmarking 
   } = usePerformanceStore();
   
   if (!showFpsCounter) return null;
   
   // Color based on FPS
   const fpsColor = currentFps >= 240 ? 'text-green-400' 
     : currentFps >= 60 ? 'text-yellow-400' 
     : 'text-red-400';
   
   return (
     <div className="fixed top-16 right-4 z-50 bg-black/80 text-white font-mono text-xs p-2 rounded-lg border border-white/20 min-w-[120px]">
       <div className="flex items-center justify-between mb-1">
         <span className="text-muted-foreground">FPS</span>
         <span className={`text-lg font-bold ${fpsColor}`}>{currentFps}</span>
       </div>
       
       <div className="space-y-0.5 text-[10px]">
         <div className="flex justify-between">
           <span className="text-muted-foreground">Avg:</span>
           <span>{avgFps}</span>
         </div>
         <div className="flex justify-between">
           <span className="text-muted-foreground">Min:</span>
           <span>{minFps}</span>
         </div>
         <div className="flex justify-between">
           <span className="text-muted-foreground">Max:</span>
           <span>{maxFps}</span>
         </div>
         <div className="flex justify-between">
           <span className="text-muted-foreground">1% Low:</span>
           <span>{p1Low}</span>
         </div>
       </div>
       
       <div className="mt-1 pt-1 border-t border-white/10 flex justify-between">
         <span className="text-muted-foreground">Tier:</span>
         <span className={
           tier === 'ULTRA' ? 'text-purple-400' 
           : tier === 'HIGH' ? 'text-blue-400' 
           : 'text-green-400'
         }>{tier}</span>
       </div>
       
       {isBenchmarking && (
         <div className="mt-1 pt-1 border-t border-white/10 text-center">
           <span className="text-orange-400 animate-pulse">⏱ Benchmarking...</span>
         </div>
       )}
       
       <div className="mt-1 pt-1 border-t border-white/10 text-center text-[9px] text-muted-foreground">
         Press F to toggle
       </div>
     </div>
   );
 }