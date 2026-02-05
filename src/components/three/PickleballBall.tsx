 import { useRef, useMemo } from 'react';
 import * as THREE from 'three';
 import { BallState } from '@/types/game';
 
 // Shared geometry and material for all balls
 const ballGeometry = new THREE.SphereGeometry(0.037, 12, 8);
 const ballMaterial = new THREE.MeshStandardMaterial({
   color: '#ffff00',
   roughness: 0.6,
   metalness: 0.1,
 });
 
 // Hole pattern material (simplified - just color variation)
 const ballMaterialWithHoles = new THREE.MeshStandardMaterial({
   color: '#f0f000',
   roughness: 0.7,
   metalness: 0.05,
 });
 
 interface PickleballBallProps {
   ballState: BallState;
   showTrail?: boolean;
 }
 
 export function PickleballBall({ ballState, showTrail = false }: PickleballBallProps) {
   const meshRef = useRef<THREE.Mesh>(null);
   
   if (!ballState.isVisible) return null;
   
   return (
     <group>
       {/* Main ball */}
       <mesh
         ref={meshRef}
         geometry={ballGeometry}
         material={ballMaterial}
         position={[ballState.position.x, ballState.position.y, ballState.position.z]}
         castShadow
       />
       
       {/* Simple trail effect - just 3 fading spheres */}
       {showTrail && (
         <>
           <mesh
             geometry={ballGeometry}
             position={[
               ballState.position.x - ballState.velocity.x * 0.02,
               ballState.position.y - ballState.velocity.y * 0.02,
               ballState.position.z - ballState.velocity.z * 0.02,
             ]}
           >
             <meshBasicMaterial color="#ffff00" transparent opacity={0.4} />
           </mesh>
           <mesh
             geometry={ballGeometry}
             position={[
               ballState.position.x - ballState.velocity.x * 0.04,
               ballState.position.y - ballState.velocity.y * 0.04,
               ballState.position.z - ballState.velocity.z * 0.04,
             ]}
           >
             <meshBasicMaterial color="#ffff00" transparent opacity={0.2} />
           </mesh>
         </>
       )}
     </group>
   );
 }