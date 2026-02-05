 import { useRef, useMemo } from 'react';
 import * as THREE from 'three';
 import { PlayerState } from '@/types/game';
 
 // Player dimensions
 const PLAYER_HEIGHT = 1.7;
 const PLAYER_RADIUS = 0.22;
 const HEAD_RADIUS = 0.14;
 
 // Shared geometries - created once
 const bodyGeometry = new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - PLAYER_RADIUS * 2 - HEAD_RADIUS * 2, 4, 8);
 const headGeometry = new THREE.SphereGeometry(HEAD_RADIUS, 8, 8);
 const armGeometry = new THREE.CapsuleGeometry(0.06, 0.4, 2, 4);
 const paddleGeometry = new THREE.BoxGeometry(0.18, 0.02, 0.12);
 
 // Team colors
 const teamAMaterial = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.6 });
 const teamBMaterial = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.6 });
 const skinMaterial = new THREE.MeshStandardMaterial({ color: '#e0b090', roughness: 0.7 });
 const paddleMaterial = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });
 
 interface AnimatedPlayerProps {
   playerState: PlayerState;
   playerIndex: number;
 }
 
 export function AnimatedPlayer({ playerState, playerIndex }: AnimatedPlayerProps) {
   const groupRef = useRef<THREE.Group>(null);
   const armRef = useRef<THREE.Group>(null);
   
   const bodyMaterial = playerState.team === 'A' ? teamAMaterial : teamBMaterial;
   
   // Calculate arm rotation based on animation state
   const armRotation = useMemo(() => {
     switch (playerState.animState) {
       case 'swing':
         // Swing animation: rotate arm forward
         const swingAngle = Math.sin(playerState.swingPhase * Math.PI) * 1.5;
         return { x: -swingAngle, y: 0, z: 0.2 };
       case 'serve':
         // Serve: underhand motion
         const serveAngle = playerState.swingPhase * Math.PI;
         return { x: Math.sin(serveAngle) * 1.2 - 0.5, y: 0, z: 0.3 };
       case 'celebrate':
         // Arms up!
         return { x: -2.5, y: 0, z: 0.5 };
       case 'ready':
         return { x: -0.3, y: 0, z: 0.2 };
       default:
         return { x: 0, y: 0, z: 0.1 };
     }
   }, [playerState.animState, playerState.swingPhase]);
   
   // Body bob animation based on state
   const bodyOffset = useMemo(() => {
     if (playerState.animState === 'celebrate') {
       return Math.sin(performance.now() * 0.01) * 0.1;
     }
     if (playerState.animState === 'moving') {
       return Math.sin(performance.now() * 0.02) * 0.05;
     }
     return 0;
   }, [playerState.animState]);
   
   return (
     <group
       ref={groupRef}
       position={[
         playerState.currentPosition.x,
         bodyOffset,
         playerState.currentPosition.z
       ]}
       rotation={[0, playerState.facingAngle, 0]}
     >
       {/* Body */}
       <mesh
         geometry={bodyGeometry}
         material={bodyMaterial}
         position={[0, PLAYER_HEIGHT / 2, 0]}
         castShadow
       />
       
       {/* Head */}
       <mesh
         geometry={headGeometry}
         material={skinMaterial}
         position={[0, PLAYER_HEIGHT - HEAD_RADIUS, 0]}
         castShadow
       />
       
       {/* Right arm with paddle */}
       <group
         ref={armRef}
         position={[PLAYER_RADIUS + 0.08, PLAYER_HEIGHT * 0.65, 0]}
         rotation={[armRotation.x, armRotation.y, armRotation.z]}
       >
         {/* Upper arm */}
         <mesh
           geometry={armGeometry}
           material={skinMaterial}
           position={[0, -0.15, 0]}
           rotation={[0, 0, 0]}
         />
         
         {/* Paddle */}
         <mesh
           geometry={paddleGeometry}
           material={paddleMaterial}
           position={[0.1, -0.35, 0]}
           rotation={[0.2, 0, 0.3]}
         />
       </group>
       
       {/* Left arm */}
       <group
         position={[-PLAYER_RADIUS - 0.08, PLAYER_HEIGHT * 0.65, 0]}
         rotation={[-0.2, 0, -0.2]}
       >
         <mesh
           geometry={armGeometry}
           material={skinMaterial}
           position={[0, -0.15, 0]}
         />
       </group>
     </group>
   );
 }