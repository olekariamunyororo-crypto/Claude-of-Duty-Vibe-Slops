// Procedural textures (DOM canvas) + stand-in models.
import * as THREE from 'three';
import { useMemo } from 'react';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export function noiseTexture(size = 64, base: [number, number, number] = [200, 200, 200], variation = 26, repeat = 4): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (Math.random() - 0.5) * 2 * variation;
    img.data[i * 4] = Math.max(0, Math.min(255, base[0] + n));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, base[1] + n));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, base[2] + n));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function helipadTexture(size = 256): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const c = size / 2;
  ctx.fillStyle = '#1e2228'; ctx.beginPath(); ctx.arc(c, c, c * 0.96, 0, 7); ctx.fill();
  ctx.strokeStyle = '#f0c828'; ctx.lineWidth = size * 0.055;
  ctx.beginPath(); ctx.arc(c, c, c * 0.86, 0, 7); ctx.stroke();
  ctx.fillStyle = '#ebebeb';
  const w = size * 0.07, h = size * 0.43;
  ctx.fillRect(c - size * 0.18 - w / 2, c - h / 2, w, h);
  ctx.fillRect(c + size * 0.18 - w / 2, c - h / 2, w, h);
  ctx.fillRect(c - size * 0.14, c - w / 2, size * 0.28, w);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function cloneScene(scene: THREE.Object3D): THREE.Group {
  return SkeletonUtils.clone(scene) as unknown as THREE.Group;
}

/**
 * Clone + normalize a GLTF scene: longest axis → targetLen, rotated to Z, base at -yOffset.
 * Pass skipAutoRotate to disable the horizontal-axis auto-rotate heuristic below — it assumes
 * an elongated vehicle/prop (longer on X than Z means "sideways"), which is a poor fit for
 * roughly-square-footprint humanoid models, where it can misfire and rotate the character
 * 90° off from its intended facing.
 */
export function useNormalizedModel(source: THREE.Object3D, targetLen: number, yOffset = 0, skipAutoRotate = false): THREE.Group {
  return useMemo(() => {
    const root = cloneScene(source);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = targetLen / Math.max(Math.max(size.x, size.y, size.z), 1e-6);
    root.scale.setScalar(s);
    if (!skipAutoRotate && size.x > size.z * 1.2) root.rotation.y = Math.PI / 2;
    const box2 = new THREE.Box3().setFromObject(root);
    const c = box2.getCenter(new THREE.Vector3());
    root.position.x -= c.x; root.position.z -= c.z;
    root.position.y -= box2.min.y + yOffset;
    const wrap = new THREE.Group();
    wrap.add(root);
    return wrap;
  }, [source, targetLen, yOffset, skipAutoRotate]);
}

export function ghostStandIn(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.85, 4, 10), new THREE.MeshLambertMaterial({ color: '#262b31' }));
  body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshLambertMaterial({ color: '#1c2026' }));
  head.position.y = 1.68; g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.06), new THREE.MeshBasicMaterial({ color: '#ffb020' }));
  visor.position.set(0, 1.69, -0.19); g.add(visor);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.55), new THREE.MeshLambertMaterial({ color: '#111417' }));
  gun.position.set(0.26, 1.25, -0.3); g.add(gun);
  return g;
}

export function nv4StandIn(): THREE.Group {
  const g = new THREE.Group();
  const gm = new THREE.MeshLambertMaterial({ color: '#171a1e' });
  const am = new THREE.MeshBasicMaterial({ color: '#ff8c1a' });
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material = gm) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh);
  };
  add(new THREE.BoxGeometry(0.09, 0.13, 0.52), 0, 0, 0);
  add(new THREE.BoxGeometry(0.05, 0.05, 0.42), 0, 0.01, -0.45);
  add(new THREE.BoxGeometry(0.06, 0.22, 0.09), 0, -0.16, 0.06);
  add(new THREE.BoxGeometry(0.07, 0.1, 0.2), 0, -0.02, 0.32);
  add(new THREE.BoxGeometry(0.03, 0.05, 0.16), 0, 0.1, -0.18, am);
  return g;
}
