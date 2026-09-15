// Renders nothing — composes the camera from T after ticks each frame.
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { applyCamera } from '../player/Camera';

export function Player() {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useFrame((_, dt) => applyCamera(camera, Math.min(dt, 0.05)));

  return null;
}
