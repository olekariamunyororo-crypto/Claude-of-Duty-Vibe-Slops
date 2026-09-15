import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGame, type Quality } from '../store/gameStore';
import { initInput } from '../input/InputManager';
import { SUN_DIRECTION, Sky } from './Sky';
import { Ocean } from './Ocean';
import { MapMeshes } from './Map';
import { Player } from './Player';
import { WeaponViewModel } from './WeaponViewModel';
import { BotsView } from './BotsView';
import { Effects } from './Effects';
import { GameLoop } from './GameLoop';

const DPR: Record<Quality, [number, number]> = { low: [0.6, 1], med: [0.8, 1.5], high: [1, 2] };

export function GameCanvas() {
  const quality = useGame((s) => s.settings.quality);
  const fov = useGame((s) => s.settings.fov);

  return (
    <Canvas
      className="absolute inset-0"
      dpr={DPR[quality]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov, near: 0.05, far: 600, position: [0, 5, -25] }}
      shadows={quality === 'high'}
      onCreated={({ gl }) => { gl.setClearColor('#0a1420'); initInput(gl.domElement); }}
    >
      <Suspense fallback={null}>
        <hemisphereLight args={['#cfe8ff', '#2a3b4d', 1.05]} />
        <directionalLight
          position={SUN_DIRECTION.clone().multiplyScalar(120).toArray()}
          intensity={1.6} color="#fff1d6"
          castShadow={quality === 'high'}
          shadow-mapSize-width={1024} shadow-mapSize-height={1024}
          shadow-camera-left={-45} shadow-camera-right={45}
          shadow-camera-top={45} shadow-camera-bottom={-45}
        />
        <pointLight position={[0, 6.2, 0]} intensity={40} distance={18} color="#7fe3ff" />
        <pointLight position={[0, 4, -22]} intensity={18} distance={14} color="#ffd9a0" />

        <Sky quality={quality} />
        <Ocean quality={quality} />
        <MapMeshes />
        <GameLoop />
        <Player />
        <WeaponViewModel />
        <BotsView />
        <Effects />
      </Suspense>
    </Canvas>
  );
}
