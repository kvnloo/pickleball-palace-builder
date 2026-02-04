import { AppHeader } from '@/components/AppHeader';
import { ControlPanel } from '@/components/controls/ControlPanel';
import { FacilityCanvas } from '@/components/three/FacilityCanvas';
import { HomebasePanel } from '@/components/homebase/HomebasePanel';
import { HomebaseCanvas } from '@/components/three/HomebaseCanvas';
import { useFacilityStore } from '@/stores/facilityStore';

const Index = () => {
  const { mode } = useFacilityStore();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <AppHeader />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-80 flex-shrink-0">
          {mode === 'build' ? <ControlPanel /> : <HomebasePanel />}
        </div>

        {/* Right panel - 3D Canvas */}
        <div className="flex-1">
          {mode === 'build' ? <FacilityCanvas /> : <HomebaseCanvas />}
        </div>
      </div>
    </div>
  );
};

export default Index;
